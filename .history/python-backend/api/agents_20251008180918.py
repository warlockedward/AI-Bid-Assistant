"""
Agent API endpoints for TypeScript-Python integration
"""
import json
import importlib
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel


router = APIRouter(prefix="/api", tags=["agents"])


class TenderAnalysisRequest(BaseModel):
    """招标分析请求模型"""
    filename: str
    content: str
    project_id: str
    tenant_id: str


class KnowledgeRetrievalRequest(BaseModel):
    """知识检索请求模型"""
    query: str
    context: Dict[str, Any]
    tenant_id: str


class ContentGenerationRequest(BaseModel):
    """内容生成请求模型"""
    section: str
    requirements: List[Dict[str, Any]]
    knowledge_base: List[Dict[str, Any]]
    tenant_id: str


class ComplianceVerificationRequest(BaseModel):
    """合规验证请求模型"""
    generated_content: List[Dict[str, Any]]
    requirements: List[Dict[str, Any]]
    compliance_rules: List[str]
    tenant_id: str


def _import_config():
    """延迟导入config模块"""
    return importlib.import_module("config")


def _import_tender_analysis_agent():
    """延迟导入TenderAnalysisAgent"""
    return importlib.import_module("agents.tender_analysis_agent")


def _import_knowledge_retrieval_agent():
    """延迟导入KnowledgeRetrievalAgent"""
    return importlib.import_module("agents.knowledge_retrieval_agent")


def _import_content_generation_agent():
    """延迟导入ContentGenerationAgent"""
    return importlib.import_module("agents.content_generation_agent")


def _import_compliance_verification_agent():
    """延迟导入ComplianceVerificationAgent"""
    return importlib.import_module("agents.compliance_verification_agent")


@router.post("/analyze-tender")
async def analyze_tender_document(request: TenderAnalysisRequest):
    """
    Analyze tender document using TenderAnalysisAgent
    """
    try:
        # Import modules
        config_module = _import_config()
        tender_agent_module = _import_tender_analysis_agent()

        # Get tenant configuration
        tenant_config = config_module.get_tenant_config(request.tenant_id)

        # Create agent instance
        agent_class = getattr(tender_agent_module, "TenderAnalysisAgent")
        agent = agent_class(request.tenant_id, tenant_config)

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
            detail="Tender analysis failed: %s" % str(e)
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
        # Import modules
        config_module = _import_config()
        knowledge_agent_module = _import_knowledge_retrieval_agent()

        # Parse context JSON
        context_dict = json.loads(context) if context else {}

        # Get tenant configuration
        tenant_config = config_module.get_tenant_config(tenant_id)

        # Create agent instance
        agent_class = getattr(
            knowledge_agent_module, 
            "KnowledgeRetrievalAgent"
        )
        agent = agent_class(tenant_id, tenant_config)

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
            detail="Knowledge retrieval failed: %s" % str(e)
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
        # Import modules
        config_module = _import_config()
        content_agent_module = _import_content_generation_agent()

        # Parse JSON parameters
        req_list = json.loads(requirements) if requirements else []
        kb_list = json.loads(knowledge_base) if knowledge_base else []

        # Get tenant configuration
        tenant_config = config_module.get_tenant_config(tenant_id)

        # Create agent instance
        agent_class = getattr(content_agent_module, "ContentGenerationAgent")
        agent = agent_class(tenant_id, tenant_config)

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
            detail="Content generation failed: %s" % str(e)
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
        # Import modules
        config_module = _import_config()
        compliance_agent_module = _import_compliance_verification_agent()

        # Parse JSON parameters
        content_list = (
            json.loads(generated_content) if generated_content else []
        )
        req_list = json.loads(requirements) if requirements else []
        rules_list = (
            json.loads(compliance_rules) if compliance_rules else []
        )

        # Get tenant configuration
        tenant_config = config_module.get_tenant_config(tenant_id)

        # Create agent instance
        agent_class = getattr(
            compliance_agent_module, 
            "ComplianceVerificationAgent"
        )
        agent = agent_class(tenant_id, tenant_config)

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
            detail="Compliance verification failed: %s" % str(e)
        ) from e
