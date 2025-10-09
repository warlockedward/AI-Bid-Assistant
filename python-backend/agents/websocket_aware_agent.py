"""
WebSocket-aware agent base class
Provides real-time status updates to the frontend via WebSocket
"""

import asyncio
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod

from api.websocket_sync import notify_agent_status, notify_workflow_status, notify_workflow_progress


class WebSocketAwareAgent(ABC):
    """Base class for agents that send real-time updates via WebSocket"""
    
    def __init__(self, agent_id: str, workflow_id: str):
        self.agent_id = agent_id
        self.workflow_id = workflow_id
        self.current_progress = 0
        self.current_task = ""
        self.total_steps = 0
        self.completed_steps = 0
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the agent with WebSocket status updates"""
        try:
            # Notify start
            await self.notify_status("processing", 0, f"Starting {self.agent_id}")
            
            # Execute the actual agent logic
            result = await self.process(input_data)
            
            # Notify completion
            await self.notify_status("completed", 100, f"Completed {self.agent_id}")
            
            return result
            
        except Exception as e:
            # Notify error
            await self.notify_status("error", self.current_progress, f"Error in {self.agent_id}: {str(e)}")
            raise
    
    @abstractmethod
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Implement the actual agent processing logic"""
        pass
    
    async def notify_status(
        self,
        status: str,
        progress: int,
        message: str,
        current_task: Optional[str] = None,
        requires_response: bool = False
    ):
        """Send status update via WebSocket"""
        try:
            await notify_agent_status(
                workflow_id=self.workflow_id,
                agent_id=self.agent_id,
                status=status,
                progress=progress,
                message=message,
                current_task=current_task or self.current_task,
                requires_response=requires_response
            )
            
            self.current_progress = progress
            if current_task:
                self.current_task = current_task
                
        except Exception as e:
            print(f"Failed to send WebSocket update: {e}")
    
    async def request_user_input(self, message: str, timeout: int = 60) -> Optional[str]:
        """Request input from user via WebSocket"""
        try:
            # Import the websocket sync service
            from api.websocket_sync import websocket_sync_service
            
            # Send request for user input
            await self.notify_status(
                status="waiting_input",
                progress=self.current_progress,
                message=message,
                requires_response=True
            )
            
            # Wait for user response via the WebSocket sync service
            response = await websocket_sync_service.get_user_response(
                self.workflow_id, 
                self.agent_id, 
                timeout
            )
            
            if response:
                await self.notify_status(
                    status="processing",
                    progress=self.current_progress,
                    message=f"Received user response: {response}",
                    requires_response=False
                )
                return response
            else:
                await self.notify_status(
                    status="error",
                    progress=self.current_progress,
                    message="Timeout waiting for user response",
                    requires_response=False
                )
                return None
            
        except Exception as e:
            print(f"Failed to request user input: {e}")
            await self.notify_status(
                status="error",
                progress=self.current_progress,
                message=f"Error requesting user input: {str(e)}",
                requires_response=False
            )
            return None
    
    async def update_progress(self, progress: int, message: str, task: Optional[str] = None):
        """Update progress during processing"""
        await self.notify_status(
            status="processing",
            progress=progress,
            message=message,
            current_task=task
        )
    
    async def update_workflow_progress(
        self, 
        completed_steps: int, 
        current_step: str, 
        step_details: Optional[Dict[str, Any]] = None
    ):
        """Update overall workflow progress"""
        if self.total_steps > 0:
            progress_percentage = (completed_steps / self.total_steps) * 100
            
            await notify_workflow_progress(
                workflow_id=self.workflow_id,
                total_steps=self.total_steps,
                completed_steps=completed_steps,
                current_step=current_step,
                progress_percentage=progress_percentage,
                step_details=step_details
            )
            
            self.completed_steps = completed_steps
    
    def set_total_steps(self, total_steps: int):
        """Set the total number of steps for this agent's workflow"""
        self.total_steps = total_steps


class WebSocketTenderAnalysisAgent(WebSocketAwareAgent):
    """Tender analysis agent with WebSocket updates"""
    
    def __init__(self, workflow_id: str):
        super().__init__("tender-analysis", workflow_id)
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process tender document analysis with progress updates"""
        
        # Step 1: Parse document
        await self.update_progress(20, "Parsing tender document", "Document parsing")
        await asyncio.sleep(1)  # Simulate processing
        
        # Step 2: Extract requirements
        await self.update_progress(50, "Extracting requirements", "Requirement extraction")
        await asyncio.sleep(1.5)
        
        # Step 3: Analyze compliance criteria
        await self.update_progress(80, "Analyzing compliance criteria", "Compliance analysis")
        await asyncio.sleep(1)
        
        # Return analysis results
        return {
            "requirements": [
                "Technical specifications compliance",
                "Financial requirements",
                "Delivery timeline",
                "Quality standards"
            ],
            "compliance_criteria": [
                "ISO certification required",
                "Minimum 3 years experience",
                "Local presence required"
            ],
            "risk_factors": [
                "Tight delivery schedule",
                "Complex technical requirements"
            ]
        }


class WebSocketContentGenerationAgent(WebSocketAwareAgent):
    """Content generation agent with WebSocket updates"""
    
    def __init__(self, workflow_id: str):
        super().__init__("content-generation", workflow_id)
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate bid content with progress updates"""
        
        sections = [
            "Executive Summary",
            "Technical Approach",
            "Project Timeline",
            "Team Qualifications",
            "Cost Proposal",
            "Risk Management"
        ]
        
        generated_content = {}
        
        for i, section in enumerate(sections):
            progress = int((i + 1) / len(sections) * 100)
            await self.update_progress(
                progress, 
                f"Generating {section}", 
                f"Content generation: {section}"
            )
            
            # Simulate content generation
            await asyncio.sleep(0.8)
            
            generated_content[section.lower().replace(" ", "_")] = {
                "title": section,
                "content": f"Generated content for {section}...",
                "word_count": 500 + i * 100
            }
        
        return {
            "sections": generated_content,
            "total_sections": len(sections),
            "total_words": sum(section["word_count"] for section in generated_content.values())
        }


class WebSocketComplianceAgent(WebSocketAwareAgent):
    """Compliance verification agent with WebSocket updates"""
    
    def __init__(self, workflow_id: str):
        super().__init__("compliance-verification", workflow_id)
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Verify compliance with progress updates"""
        
        checks = [
            "Format compliance",
            "Content completeness",
            "Technical requirements",
            "Financial accuracy",
            "Legal compliance"
        ]
        
        results = {}
        issues = []
        
        for i, check in enumerate(checks):
            progress = int((i + 1) / len(checks) * 100)
            await self.update_progress(
                progress,
                f"Checking {check}",
                f"Compliance check: {check}"
            )
            
            # Simulate compliance checking
            await asyncio.sleep(0.6)
            
            # Simulate some issues
            passed = i < 4  # First 4 checks pass, last one has issues
            results[check.lower().replace(" ", "_")] = {
                "status": "passed" if passed else "warning",
                "score": 100 if passed else 85
            }
            
            if not passed:
                issues.append(f"Minor issue in {check}")
        
        # Request user confirmation if there are issues
        if issues:
            user_response = await self.request_user_input(
                f"Found {len(issues)} minor issues. Proceed anyway? (yes/no)"
            )
            
            if user_response and "yes" in user_response.lower():
                await self.update_progress(100, "User approved proceeding with minor issues")
            else:
                await self.update_progress(100, "Compliance check completed with warnings")
        
        return {
            "overall_score": sum(r["score"] for r in results.values()) / len(results),
            "checks": results,
            "issues": issues,
            "status": "passed" if not issues else "warning"
        }


# Example workflow using WebSocket-aware agents
async def run_websocket_workflow(workflow_id: str, tender_document: str):
    """Example workflow using WebSocket-aware agents"""
    
    try:
        # Notify workflow start
        await notify_workflow_status(workflow_id, "running")
        
        # Initialize workflow progress (3 main steps)
        total_workflow_steps = 3
        await notify_workflow_progress(
            workflow_id=workflow_id,
            total_steps=total_workflow_steps,
            completed_steps=0,
            current_step="Starting workflow",
            progress_percentage=0.0
        )
        
        # Step 1: Tender Analysis
        await notify_workflow_progress(
            workflow_id=workflow_id,
            total_steps=total_workflow_steps,
            completed_steps=0,
            current_step="Tender Analysis",
            progress_percentage=0.0,
            step_details={
                "step_name": "Tender Analysis",
                "step_description": "Analyzing tender document and extracting requirements",
                "step_progress": 0
            }
        )
        
        analysis_agent = WebSocketTenderAnalysisAgent(workflow_id)
        analysis_agent.set_total_steps(total_workflow_steps)
        analysis_result = await analysis_agent.execute({
            "tender_document": tender_document
        })
        
        await analysis_agent.update_workflow_progress(1, "Tender Analysis Complete")
        
        # Step 2: Content Generation
        await notify_workflow_progress(
            workflow_id=workflow_id,
            total_steps=total_workflow_steps,
            completed_steps=1,
            current_step="Content Generation",
            progress_percentage=33.3,
            step_details={
                "step_name": "Content Generation",
                "step_description": "Generating bid document sections",
                "step_progress": 0
            }
        )
        
        content_agent = WebSocketContentGenerationAgent(workflow_id)
        content_agent.set_total_steps(total_workflow_steps)
        content_result = await content_agent.execute({
            "requirements": analysis_result["requirements"],
            "compliance_criteria": analysis_result["compliance_criteria"]
        })
        
        await content_agent.update_workflow_progress(2, "Content Generation Complete")
        
        # Step 3: Compliance Verification
        await notify_workflow_progress(
            workflow_id=workflow_id,
            total_steps=total_workflow_steps,
            completed_steps=2,
            current_step="Compliance Verification",
            progress_percentage=66.7,
            step_details={
                "step_name": "Compliance Verification",
                "step_description": "Verifying compliance and quality",
                "step_progress": 0
            }
        )
        
        compliance_agent = WebSocketComplianceAgent(workflow_id)
        compliance_agent.set_total_steps(total_workflow_steps)
        compliance_result = await compliance_agent.execute({
            "generated_content": content_result,
            "requirements": analysis_result["requirements"]
        })
        
        await compliance_agent.update_workflow_progress(3, "Compliance Verification Complete")
        
        # Final workflow completion
        await notify_workflow_progress(
            workflow_id=workflow_id,
            total_steps=total_workflow_steps,
            completed_steps=total_workflow_steps,
            current_step="Workflow Complete",
            progress_percentage=100.0
        )
        
        # Notify workflow completion
        await notify_workflow_status(
            workflow_id, 
            "completed",
            controls={
                "canPause": False,
                "canResume": False,
                "canCancel": False
            }
        )
        
        return {
            "analysis": analysis_result,
            "content": content_result,
            "compliance": compliance_result,
            "status": "completed"
        }
        
    except Exception as e:
        # Notify workflow error
        await notify_workflow_status(
            workflow_id,
            "error",
            controls={
                "canPause": False,
                "canResume": False,
                "canCancel": False
            }
        )
        raise


if __name__ == "__main__":
    # Example usage
    async def main():
        workflow_id = "test_workflow_123"
        tender_doc = "Sample tender document content..."
        
        result = await run_websocket_workflow(workflow_id, tender_doc)
        print("Workflow completed:", result)
    
    asyncio.run(main())