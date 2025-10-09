"""
OCR API端点 - 处理文档OCR识别请求
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging

from services.ocr_service import ocr_service

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["ocr"])


class OCRResponse(BaseModel):
    """OCR处理响应模型"""
    success: bool
    content: str
    engine_used: str
    processing_time: float
    accuracy: int
    error: Optional[str] = None


class OCRConfigResponse(BaseModel):
    """OCR配置响应模型"""
    default_engine: str
    available_engines: list[str]


@router.get("/config")
async def get_ocr_config() -> OCRConfigResponse:
    """
    获取OCR配置信息
    """
    try:
        config = ocr_service.get_config()
        return OCRConfigResponse(**config)
    except Exception as e:
        logger.error(f"获取OCR配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取OCR配置失败: {str(e)}")


@router.post("/process")
async def process_document_ocr(
    file: UploadFile = File(...),
    engine: Optional[str] = Form(None)
) -> OCRResponse:
    """
    处理文档OCR识别
    
    Args:
        file: 上传的文件
        engine: OCR引擎名称（可选，默认使用系统配置的默认引擎）
        
    Returns:
        OCR处理结果
    """
    try:
        logger.info(f"开始OCR处理 - 文件: {file.filename}, 引擎: {engine}")
        
        # 读取文件内容
        file_content = await file.read()
        
        # 调用OCR服务处理文档
        result = await ocr_service.process_document(
            file_data=file_content,
            file_name=file.filename or "unknown",
            mime_type=file.content_type or "application/octet-stream",
            engine=engine
        )
        
        logger.info(
            f"OCR处理完成 - 文件: {file.filename}, "
            f"引擎: {result['engine_used']}, "
            f"成功: {result['success']}"
        )
        
        return OCRResponse(**result)
        
    except Exception as e:
        logger.error(f"OCR处理失败 - 文件: {file.filename}, 错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR处理失败: {str(e)}")


@router.get("/engines")
async def get_available_engines() -> Dict[str, Any]:
    """
    获取可用的OCR引擎列表
    """
    try:
        engines = ocr_service.get_config()["available_engines"]
        default_engine = ocr_service.get_config()["default_engine"]
        
        # 获取每个引擎的性能信息
        engine_info = {}
        for engine in engines:
            engine_info[engine] = ocr_service.get_engine_performance(engine)
        
        return {
            "engines": engines,
            "default_engine": default_engine,
            "engine_info": engine_info
        }
    except Exception as e:
        logger.error(f"获取OCR引擎列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取OCR引擎列表失败: {str(e)}")