"""
Agent API endpoints for TypeScript-Python integration
"""
import json
import asyncio
import sys
import os
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel


router = APIRouter(prefix="/api", tags=["agents"])


class TenderAnalysisRequest(BaseModel):
    filename: str
    content: str
    project_id: str
    tenant_id: str


class KnowledgeRetrievalRequest(BaseModel):
    query: str
    context: Dict[str, Any]
    tenant_id: str


class ContentGenerationRequest(BaseModel):
    section: str
    requirements: List[Dict[str, Any]]
    knowledge_base: List[Dict[str, Any]]
    tenant_id: str


class ComplianceVerificationRequest(BaseModel):
    generated_content: List[Dict[str, Any]]
    requirements: List[Dict[str, Any]]
    compliance_rules: List[str]
    tenant_id: str


@router.post("/analyze-tender")
async def analyze_tender_document(request: TenderAnalysisRequest):
    """
    Analyze tender document using TenderAnalysisAgent
    """
    try:
        # Add current directory to path for imports
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if current_dir not in sys.path:
            sys.path.append(current_dir)

        # Import here to avoid circular imports
        from config import get_tenant_config
        from agents.tender_analysis_agent import TenderAnalysisAgent

        # Get tenant configuration
        tenant_config = get_tenant_config(request.tenant_id)

        # Create agent instance
        agent = TenderAnalysisAgent(request.tenant_id, tenant_config)

        # Execute analysis
        result = await agent.execute({
            "document": request.content,
            "operation": "analyze_document"
        })

        return {
            "agent_type": "tender_analysis",
            "status": "success",
            "output": result,
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Tender analysis failed: {str(e)}"
        ) from e


@router.get("/retrieve-knowledge")
async def retrieve_knowledge(
    query: str,
    context: str = Query(...),
    tenant_id: str = Query(...)
):
    """
    Retrieve knowledge using KnowledgeRetrievalAgent
    """
    try:
        # Add current directory to path for imports
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if current_dir not in sys.path:
            sys.path.append(current_dir)

        # Import here to avoid circular imports
        from config import get_tenant_config
        from agents.knowledge_retrieval_agent import KnowledgeRetrievalAgent

        # Parse context JSON
        context_dict = json.loads(context) if context else {}

        # Get tenant configuration
        tenant_config = get_tenant_config(tenant_id)

        # Create agent instance
        agent = KnowledgeRetrievalAgent(tenant_id, tenant_config)

        # Execute knowledge retrieval
        result = await agent.execute({
            "query": query,
            "context": context_dict
        })

        return {
            "agent_type": "knowledge_retrieval",
            "status": "success",
            "output": result,
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid context JSON format"
        ) from exc
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Knowledge retrieval failed: {str(e)}"
        ) from e


@router.get("/generate-content")
async def generate_content(
    section: str,
    requirements: str = Query(...),
    knowledge_base: str = Query(...),
    tenant_id: str = Query(...)
):
    """
    Generate content using ContentGenerationAgent
    """
    try:
        # Add current directory to path for imports
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if current_dir not in sys.path:
            sys.path.append(current_dir)

        # Import here to avoid circular imports
        from config import get_tenant_config
        from agents.content_generation_agent import ContentGenerationAgent

        # Parse JSON parameters
        req_list = json.loads(requirements) if requirements else []
        kb_list = json.loads(knowledge_base) if knowledge_base else []

        # Get tenant configuration
        tenant_config = get_tenant_config(tenant_id)

        # Create agent instance
        agent = ContentGenerationAgent(tenant_id, tenant_config)

        # Execute content generation
        result = await agent.execute({
            "section": section,
            "requirements": req_list,
            "knowledgeBase": kb_list
        })

        return {
            "agent_type": "content_generation",
            "status": "success",
            "output": result,
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON format in parameters"
        ) from exc
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Content generation failed: {str(e)}"
        ) from e


@router.get("/verify-compliance")
async def verify_compliance(
    generated_content: str = Query(...),
    requirements: str = Query(...),
    compliance_rules: str = Query(...),
    tenant_id: str = Query(...)
):
    """
    Verify compliance using ComplianceVerificationAgent
    """
    try:
        # Add current directory to path for imports
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if current_dir not in sys.path:
            sys.path.append(current_dir)

        # Import here to avoid circular imports
        from config import get_tenant_config
        from agents.compliance_verification_agent import ComplianceVerificationAgent

        # Parse JSON parameters
        content_list = (json.loads(generated_content) 
                       if generated_content else [])
        req_list = json.loads(requirements) if requirements else []
        rules_list = json.loads(compliance_rules) if compliance_rules else []

        # Get tenant configuration
        tenant_config = get_tenant_config(tenant_id)

        # Create agent instance
        agent = ComplianceVerificationAgent(tenant_id, tenant_config)

        # Execute compliance verification
        result = await agent.execute({
            "generated_content": content_list,
            "requirements": req_list,
            "compliance_rules": rules_list
        })

        return {
            "agent_type": "compliance_verification",
            "status": "success",
            "output": result,
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON format in parameters"
        ) from exc
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Compliance verification failed: {str(e)}"
        ) from e