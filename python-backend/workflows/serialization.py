"""
JSON serialization utilities for workflow state data.
Handles complex data types and ensures consistent serialization/deserialization.
"""
import json
import uuid
from datetime import datetime, date
from typing import Any, Dict, List, Union
from decimal import Decimal


class WorkflowStateEncoder(json.JSONEncoder):
    """
    Custom JSON encoder for workflow state data.
    Handles UUID, datetime, date, and Decimal objects.
    """
    
    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return {"__type__": "uuid", "value": str(obj)}
        elif isinstance(obj, datetime):
            return {"__type__": "datetime", "value": obj.isoformat()}
        elif isinstance(obj, date):
            return {"__type__": "date", "value": obj.isoformat()}
        elif isinstance(obj, Decimal):
            return {"__type__": "decimal", "value": str(obj)}
        elif hasattr(obj, '__dict__'):
            # Handle custom objects by converting to dict
            return {"__type__": "object", "class": obj.__class__.__name__, "value": obj.__dict__}
        
        return super().default(obj)


def workflow_state_decoder(dct: Dict[str, Any]) -> Any:
    """
    Custom JSON decoder for workflow state data.
    Reconstructs UUID, datetime, date, and Decimal objects.
    """
    if "__type__" in dct:
        type_name = dct["__type__"]
        value = dct["value"]
        
        if type_name == "uuid":
            return uuid.UUID(value)
        elif type_name == "datetime":
            return datetime.fromisoformat(value)
        elif type_name == "date":
            return date.fromisoformat(value)
        elif type_name == "decimal":
            return Decimal(value)
        elif type_name == "object":
            # For custom objects, return as dict with class info
            return {"__class__": dct["class"], **value}
    
    return dct


def serialize_workflow_data(data: Any) -> str:
    """
    Serialize workflow data to JSON string.
    
    Args:
        data: Data to serialize
        
    Returns:
        JSON string representation
    """
    return json.dumps(data, cls=WorkflowStateEncoder, ensure_ascii=False, separators=(',', ':'))


def deserialize_workflow_data(json_str: str) -> Any:
    """
    Deserialize workflow data from JSON string.
    
    Args:
        json_str: JSON string to deserialize
        
    Returns:
        Deserialized data
    """
    return json.loads(json_str, object_hook=workflow_state_decoder)


def validate_workflow_data(data: Any) -> bool:
    """
    Validate that data can be serialized and deserialized correctly.
    
    Args:
        data: Data to validate
        
    Returns:
        True if data is valid for serialization, False otherwise
    """
    try:
        serialized = serialize_workflow_data(data)
        deserialized = deserialize_workflow_data(serialized)
        return True
    except (TypeError, ValueError, json.JSONDecodeError):
        return False


def sanitize_workflow_data(data: Any, max_depth: int = 10) -> Any:
    """
    Sanitize workflow data by removing circular references and limiting depth.
    
    Args:
        data: Data to sanitize
        max_depth: Maximum nesting depth allowed
        
    Returns:
        Sanitized data safe for serialization
    """
    def _sanitize(obj: Any, depth: int, seen: set) -> Any:
        if depth > max_depth:
            return f"<max_depth_exceeded:{type(obj).__name__}>"
        
        if id(obj) in seen:
            return f"<circular_reference:{type(obj).__name__}>"
        
        if isinstance(obj, (str, int, float, bool, type(None))):
            return obj
        elif isinstance(obj, (uuid.UUID, datetime, date, Decimal)):
            return obj
        elif isinstance(obj, dict):
            seen.add(id(obj))
            result = {}
            for key, value in obj.items():
                if isinstance(key, str):
                    result[key] = _sanitize(value, depth + 1, seen.copy())
            return result
        elif isinstance(obj, (list, tuple)):
            seen.add(id(obj))
            return [_sanitize(item, depth + 1, seen.copy()) for item in obj]
        else:
            # For other objects, try to convert to dict
            try:
                if hasattr(obj, '__dict__'):
                    seen.add(id(obj))
                    return _sanitize(obj.__dict__, depth + 1, seen.copy())
                else:
                    return str(obj)
            except:
                return f"<unserializable:{type(obj).__name__}>"
    
    return _sanitize(data, 0, set())


class WorkflowDataManager:
    """
    Manager class for handling workflow data serialization with validation and sanitization.
    """
    
    @staticmethod
    def prepare_for_storage(data: Any) -> Dict[str, Any]:
        """
        Prepare data for storage in the database.
        
        Args:
            data: Raw workflow data
            
        Returns:
            Dictionary ready for JSON storage
        """
        # Sanitize the data first
        sanitized = sanitize_workflow_data(data)
        
        # Validate it can be serialized
        if not validate_workflow_data(sanitized):
            raise ValueError("Data cannot be safely serialized for workflow storage")
        
        return sanitized
    
    @staticmethod
    def load_from_storage(json_data: Union[str, Dict[str, Any]]) -> Any:
        """
        Load data from database storage.
        
        Args:
            json_data: JSON string or dict from database
            
        Returns:
            Deserialized workflow data
        """
        if isinstance(json_data, str):
            return deserialize_workflow_data(json_data)
        elif isinstance(json_data, dict):
            return json_data
        else:
            raise ValueError(f"Invalid data type for workflow storage: {type(json_data)}")
    
    @staticmethod
    def merge_state_data(base_data: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge workflow state data with updates.
        
        Args:
            base_data: Base workflow state data
            updates: Updates to apply
            
        Returns:
            Merged state data
        """
        def _deep_merge(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
            result = base.copy()
            for key, value in update.items():
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = _deep_merge(result[key], value)
                else:
                    result[key] = value
            return result
        
        merged = _deep_merge(base_data, updates)
        return WorkflowDataManager.prepare_for_storage(merged)