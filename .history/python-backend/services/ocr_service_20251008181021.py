"""
OCR服务模块 - 处理PDF和其他文档的OCR识别
"""
# cSpell:ignore MINERU OLMOCR mineru olmocr
import os
import asyncio
import logging
from typing import Dict, Any, Optional
from enum import Enum

# 配置日志
logger = logging.getLogger(__name__)

class OCREngine(Enum):
    """OCR引擎枚举"""
    MINERU = "mineru"
    MARKER_PDF = "marker-pdf"
    OLMOCR = "olmocr"

class OCRService:
    """OCR服务类"""

    def __init__(self):
        """初始化OCR服务"""
        self.default_engine = os.getenv("DEFAULT_OCR_ENGINE", "marker-pdf")
        self.available_engines = os.getenv(
            "OCR_AVAILABLE_ENGINES",
            "mineru,marker-pdf,olmocr"
        ).split(",")

        # 确保默认引擎在可用引擎列表中
        if self.default_engine not in self.available_engines:
            if self.available_engines:
                self.default_engine = self.available_engines[0]
            else:
                self.default_engine = "marker-pdf"

    def get_config(self) -> Dict[str, Any]:
        """获取OCR配置"""
        return {
            "default_engine": self.default_engine,
            "available_engines": self.available_engines
        }

    def is_engine_available(self, engine: str) -> bool:
        """检查OCR引擎是否可用"""
        return engine in self.available_engines

    async def process_document(
        self,
        file_data: bytes,
        file_name: str,
        mime_type: str,
        engine: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        处理文档OCR识别

        Args:
            file_data: 文件二进制数据
            file_name: 文件名
            mime_type: MIME类型
            engine: OCR引擎名称

        Returns:
            Dict: OCR处理结果
        """
        engine_to_use = engine or self.default_engine
        start_time = asyncio.get_event_loop().time()

        # 验证引擎可用性
        if not self.is_engine_available(engine_to_use):
            return {
                "success": False,
                "content": "",
                "engine_used": engine_to_use,
                "processing_time": 0,
                "accuracy": 0,
                "error": "OCR引擎 '%s' 不可用" % engine_to_use
            }

        try:
            # 根据不同引擎调用相应的处理逻辑
            if engine_to_use == OCREngine.MINERU.value:
                result = await self._process_with_mineru(
                    file_data, file_name, mime_type)
            elif engine_to_use == OCREngine.MARKER_PDF.value:
                result = await self._process_with_marker_pdf(
                    file_data, file_name, mime_type)
            elif engine_to_use == OCREngine.OLMOCR.value:
                result = await self._process_with_olmocr(
                    file_data, file_name, mime_type)
            else:
                result = await self._process_with_marker_pdf(
                    file_data, file_name, mime_type)

            # 添加处理时间
            processing_time = asyncio.get_event_loop().time() - start_time
            result["processing_time"] = processing_time

            logger.info(
                "OCR处理完成 - 引擎: %s, 文件: %s, 耗时: %.2f秒",
                engine_to_use, file_name, processing_time
            )
            return result

        except Exception as e:
            processing_time = asyncio.get_event_loop().time() - start_time
            logger.error(
                "OCR处理失败 - 引擎: %s, 文件: %s, 错误: %s",
                engine_to_use, file_name, str(e)
            )
            return {
                "success": False,
                "content": "",
                "engine_used": engine_to_use,
                "processing_time": processing_time,
                "accuracy": 0,
                "error": str(e)
            }

    async def _process_with_mineru(
        self,
        file_data: bytes,
        file_name: str,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        使用MinerU处理文档

        Args:
            file_data: 文件二进制数据
            file_name: 文件名
            mime_type: MIME类型

        Returns:
            Dict: OCR处理结果
        """
        logger.info("使用MinerU处理文档: %s", file_name)

        try:
            # 这里应该调用实际的MinerU OCR服务
            # 暂时返回模拟结果
            await asyncio.sleep(2)  # 模拟处理时间

            return {
                "success": True,
                "content": (
                    "这是使用MinerU OCR引擎处理的%s文档内容。\n\n"
                    "文档包含多页内容，MinerU能够准确识别复杂布局和表格结构。" % file_name
                ),
                "engine_used": OCREngine.MINERU.value,
                "accuracy": 95
            }
        except Exception as e:
            raise Exception("MinerU处理失败: %s" % str(e)) from e

    async def _process_with_marker_pdf(
        self,
        file_data: bytes,
        file_name: str,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        使用Marker PDF处理文档

        Args:
            file_data: 文件二进制数据
            file_name: 文件名
            mime_type: MIME类型

        Returns:
            Dict: OCR处理结果
        """
        logger.info("使用Marker PDF处理文档: %s", file_name)

        try:
            # 这里应该调用实际的Marker PDF OCR服务
            # 暂时返回模拟结果
            await asyncio.sleep(1)  # 模拟处理时间

            return {
                "success": True,
                "content": (
                    "这是使用Marker PDF OCR引擎处理的%s文档内容。\n\n"
                    "该引擎快速高效，适用于大多数PDF文档类型。" % file_name
                ),
                "engine_used": OCREngine.MARKER_PDF.value,
                "accuracy": 92
            }
        except Exception as e:
            raise Exception("Marker PDF处理失败: %s" % str(e)) from e

    async def _process_with_olmocr(
        self,
        file_data: bytes,
        file_name: str,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        使用OLM OCR处理文档

        Args:
            file_data: 文件二进制数据
            file_name: 文件名
            mime_type: MIME类型

        Returns:
            Dict: OCR处理结果
        """
        logger.info("使用OLM OCR处理文档: %s", file_name)

        try:
            # 这里应该调用实际的OLM OCR服务
            # 暂时返回模拟结果
            await asyncio.sleep(3)  # 模拟处理时间

            return {
                "success": True,
                "content": (
                    "这是使用OLM OCR引擎处理的%s文档内容。\n\n"
                    "OLM OCR支持多语言识别和手写体识别，具有最高的识别准确率。" % file_name
                ),
                "engine_used": OCREngine.OLMOCR.value,
                "accuracy": 97
            }
        except Exception as e:
            raise Exception("OLM OCR处理失败: %s" % str(e)) from e

    def get_engine_performance(self, engine: str) -> Dict[str, Any]:
        """
        获取引擎性能信息

        Args:
            engine: 引擎名称

        Returns:
            Dict: 性能信息
        """
        performance_map = {
            OCREngine.MINERU.value: {"accuracy": 95, "speed": "medium"},
            OCREngine.MARKER_PDF.value: {"accuracy": 92, "speed": "fast"},
            OCREngine.OLMOCR.value: {"accuracy": 97, "speed": "slow"}
        }

        return performance_map.get(engine, {"accuracy": 90, "speed": "medium"})

# 创建单例实例
ocr_service = OCRService()
