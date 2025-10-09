"""
Structured logging system for Python backend with tenant context
"""

import json
import logging
import time
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum
from contextlib import contextmanager

class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"
    CRITICAL = "critical"

class TenantAwareLogger:
    def __init__(self, service_name: str = "intelligent-bid-system-backend"):
        self.service_name = service_name
        self.environment = "development"  # Could be set from environment
        
        # Configure Python logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(message)s'
        )
        self.logger = logging.getLogger(service_name)

    def _create_log_entry(
        self,
        level: LogLevel,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None
    ) -> Dict[str, Any]:
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level.value,
            "message": message,
            "context": {
                **(context or {}),
                "service": self.service_name,
                "environment": self.environment,
            }
        }

        if error:
            entry["error"] = {
                "name": type(error).__name__,
                "message": str(error),
                "type": type(error).__module__ + "." + type(error).__name__
            }

        return entry

    def _output(self, entry: Dict[str, Any]) -> None:
        if self.environment == "development":
            # Pretty print for development
            print(f"[{entry['timestamp']}] {entry['level'].upper()}: {entry['message']}")
            if entry.get('context') and len(entry['context']) > 2:  # More than service and environment
                print(f"Context: {json.dumps(entry['context'], indent=2)}")
            if entry.get('error'):
                print(f"Error: {entry['error']}")
        else:
            # Structured JSON for production
            print(json.dumps(entry))

    def debug(self, message: str, context: Optional[Dict[str, Any]] = None) -> None:
        entry = self._create_log_entry(LogLevel.DEBUG, message, context)
        self._output(entry)

    def info(self, message: str, context: Optional[Dict[str, Any]] = None) -> None:
        entry = self._create_log_entry(LogLevel.INFO, message, context)
        self._output(entry)

    def warn(self, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None) -> None:
        entry = self._create_log_entry(LogLevel.WARN, message, context, error)
        self._output(entry)

    def error(self, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None) -> None:
        entry = self._create_log_entry(LogLevel.ERROR, message, context, error)
        self._output(entry)

    def critical(self, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None) -> None:
        entry = self._create_log_entry(LogLevel.CRITICAL, message, context, error)
        self._output(entry)

    def with_tenant(self, tenant_id: str, user_id: Optional[str] = None):
        """Create a logger instance with tenant context"""
        base_context = {
            "tenant_id": tenant_id,
        }
        if user_id:
            base_context["user_id"] = user_id

        class TenantLogger:
            def __init__(self, parent_logger, context):
                self.parent = parent_logger
                self.context = context

            def debug(self, message: str, context: Optional[Dict[str, Any]] = None) -> None:
                merged_context = {**self.context, **(context or {})}
                self.parent.debug(message, merged_context)

            def info(self, message: str, context: Optional[Dict[str, Any]] = None) -> None:
                merged_context = {**self.context, **(context or {})}
                self.parent.info(message, merged_context)

            def warn(self, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None) -> None:
                merged_context = {**self.context, **(context or {})}
                self.parent.warn(message, merged_context, error)

            def error(self, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None) -> None:
                merged_context = {**self.context, **(context or {})}
                self.parent.error(message, merged_context, error)

            def critical(self, message: str, context: Optional[Dict[str, Any]] = None, error: Optional[Exception] = None) -> None:
                merged_context = {**self.context, **(context or {})}
                self.parent.critical(message, merged_context, error)

        return TenantLogger(self, base_context)

    @contextmanager
    def time_operation(
        self,
        operation: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """Context manager for timing operations"""
        start_time = time.time()
        operation_context = {**(context or {}), "operation": operation}
        
        self.debug(f"Starting operation: {operation}", operation_context)
        
        try:
            yield
            duration = (time.time() - start_time) * 1000  # Convert to milliseconds
            self.info(f"Operation completed: {operation}", {
                **operation_context,
                "duration": duration,
                "status": "success"
            })
        except Exception as error:
            duration = (time.time() - start_time) * 1000
            self.error(f"Operation failed: {operation}", {
                **operation_context,
                "duration": duration,
                "status": "error"
            }, error)
            raise

# Global logger instance
logger = TenantAwareLogger()