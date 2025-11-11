"""
错误处理和重试机制
实现智能体的错误恢复、重试和降级策略
"""
from typing import Dict, Any, Optional, Callable, TypeVar
import asyncio
import logging
from datetime import datetime
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryConfig:
    """重试配置"""
    
    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        """计算重试延迟（指数退避）"""
        delay = min(
            self.initial_delay * (self.exponential_base ** attempt),
            self.max_delay
        )
        
        if self.jitter:
            import random
            delay = delay * (0.5 + random.random() * 0.5)
        
        return delay


class CheckpointManager:
    """检查点管理器"""
    
    def __init__(self):
        self.checkpoints: Dict[str, Dict[str, Any]] = {}
    
    def save_checkpoint(
        self,
        workflow_id: str,
        stage: str,
        data: Dict[str, Any]
    ):
        """保存检查点"""
        if workflow_id not in self.checkpoints:
            self.checkpoints[workflow_id] = {}
        
        self.checkpoints[workflow_id][stage] = {
            "data": data,
            "timestamp": datetime.now().isoformat(),
            "stage": stage
        }
        
        logger.info(f"Checkpoint saved: {workflow_id} - {stage}")
    
    def load_checkpoint(
        self,
        workflow_id: str,
        stage: str
    ) -> Optional[Dict[str, Any]]:
        """加载检查点"""
        if workflow_id in self.checkpoints:
            checkpoint = self.checkpoints[workflow_id].get(stage)
            if checkpoint:
                logger.info(f"Checkpoint loaded: {workflow_id} - {stage}")
                return checkpoint["data"]
        return None
    
    def rollback_to_checkpoint(
        self,
        workflow_id: str,
        stage: str
    ) -> Optional[Dict[str, Any]]:
        """回滚到检查点"""
        checkpoint_data = self.load_checkpoint(workflow_id, stage)
        if checkpoint_data:
            logger.info(f"Rolled back to checkpoint: {workflow_id} - {stage}")
            # 删除后续的检查点
            if workflow_id in self.checkpoints:
                stages_to_remove = []
                for saved_stage in self.checkpoints[workflow_id].keys():
                    if saved_stage > stage:
                        stages_to_remove.append(saved_stage)
                for s in stages_to_remove:
                    del self.checkpoints[workflow_id][s]
        return checkpoint_data
    
    def clear_checkpoints(self, workflow_id: str):
        """清除工作流的所有检查点"""
        if workflow_id in self.checkpoints:
            del self.checkpoints[workflow_id]
            logger.info(f"Checkpoints cleared: {workflow_id}")


def with_retry(
    retry_config: Optional[RetryConfig] = None,
    fallback: Optional[Callable] = None
):
    """重试装饰器"""
    if retry_config is None:
        retry_config = RetryConfig()
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None
            
            for attempt in range(retry_config.max_retries + 1):
                try:
                    result = await func(*args, **kwargs)
                    
                    if attempt > 0:
                        logger.info(
                            f"{func.__name__} succeeded on attempt {attempt + 1}"
                        )
                    
                    return result
                    
                except Exception as e:
                    last_exception = e
                    
                    if attempt < retry_config.max_retries:
                        delay = retry_config.get_delay(attempt)
                        logger.warning(
                            f"{func.__name__} failed on attempt {attempt + 1}, "
                            f"retrying in {delay:.2f}s: {str(e)}"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"{func.__name__} failed after {retry_config.max_retries + 1} attempts: {str(e)}"
                        )
            
            # 所有重试都失败，尝试降级方案
            if fallback:
                try:
                    logger.info(f"Attempting fallback for {func.__name__}")
                    return await fallback(*args, **kwargs)
                except Exception as fallback_error:
                    logger.error(f"Fallback also failed: {str(fallback_error)}")
            
            # 抛出最后一个异常
            raise last_exception
        
        return wrapper
    return decorator


class ErrorRecoveryManager:
    """错误恢复管理器"""
    
    def __init__(self):
        self.checkpoint_manager = CheckpointManager()
        self.error_history: Dict[str, list] = {}
    
    def record_error(
        self,
        workflow_id: str,
        stage: str,
        error: Exception,
        context: Optional[Dict[str, Any]] = None
    ):
        """记录错误"""
        if workflow_id not in self.error_history:
            self.error_history[workflow_id] = []
        
        error_record = {
            "timestamp": datetime.now().isoformat(),
            "stage": stage,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "context": context or {}
        }
        
        self.error_history[workflow_id].append(error_record)
        logger.error(f"Error recorded: {workflow_id} - {stage} - {str(error)}")
    
    def get_error_history(self, workflow_id: str) -> list:
        """获取错误历史"""
        return self.error_history.get(workflow_id, [])
    
    def should_retry(
        self,
        workflow_id: str,
        stage: str,
        max_errors: int = 3
    ) -> bool:
        """判断是否应该重试"""
        errors = self.get_error_history(workflow_id)
        stage_errors = [e for e in errors if e["stage"] == stage]
        return len(stage_errors) < max_errors
    
    async def recover_from_error(
        self,
        workflow_id: str,
        stage: str,
        recovery_func: Callable,
        *args,
        **kwargs
    ) -> Optional[Any]:
        """从错误中恢复"""
        try:
            # 尝试从检查点恢复
            checkpoint_data = self.checkpoint_manager.load_checkpoint(
                workflow_id, stage
            )
            
            if checkpoint_data:
                logger.info(f"Recovering from checkpoint: {workflow_id} - {stage}")
                return checkpoint_data
            
            # 尝试执行恢复函数
            if recovery_func:
                logger.info(f"Executing recovery function: {workflow_id} - {stage}")
                result = await recovery_func(*args, **kwargs)
                return result
            
        except Exception as e:
            logger.error(f"Recovery failed: {workflow_id} - {stage} - {str(e)}")
            self.record_error(workflow_id, stage, e)
        
        return None
    
    def clear_error_history(self, workflow_id: str):
        """清除错误历史"""
        if workflow_id in self.error_history:
            del self.error_history[workflow_id]
            logger.info(f"Error history cleared: {workflow_id}")


class PartialFailureHandler:
    """部分失败处理器"""
    
    @staticmethod
    async def handle_partial_failure(
        results: list,
        required_success_rate: float = 0.7
    ) -> Dict[str, Any]:
        """处理部分失败的结果"""
        total = len(results)
        successful = sum(1 for r in results if not isinstance(r, Exception))
        failed = total - successful
        
        success_rate = successful / total if total > 0 else 0
        
        if success_rate >= required_success_rate:
            # 部分成功，可以继续
            return {
                "status": "partial_success",
                "success_rate": success_rate,
                "successful": successful,
                "failed": failed,
                "results": [r for r in results if not isinstance(r, Exception)],
                "errors": [r for r in results if isinstance(r, Exception)]
            }
        else:
            # 失败太多，需要重试
            return {
                "status": "insufficient_success",
                "success_rate": success_rate,
                "successful": successful,
                "failed": failed,
                "results": [r for r in results if not isinstance(r, Exception)],
                "errors": [r for r in results if isinstance(r, Exception)]
            }
    
    @staticmethod
    async def merge_partial_results(
        results: list,
        merge_strategy: str = "best_effort"
    ) -> Dict[str, Any]:
        """合并部分结果"""
        merged = {}
        
        for result in results:
            if not isinstance(result, Exception):
                if merge_strategy == "best_effort":
                    # 尽力合并所有成功的结果
                    if isinstance(result, dict):
                        merged.update(result)
                elif merge_strategy == "first_success":
                    # 只使用第一个成功的结果
                    if not merged:
                        merged = result
                    break
        
        return merged


# 全局实例
error_recovery_manager = ErrorRecoveryManager()
checkpoint_manager = CheckpointManager()
