import { ocrService } from './ocr-service';

// 测试OCR服务
async function testOCRService() {
  console.log('Testing OCR Service...');
  
  // 获取配置
  const config = ocrService.getConfig();
  console.log('OCR Config:', config);
  
  // 获取可用引擎
  const engines = await ocrService.getAvailableEngines();
  console.log('Available Engines:', engines);
  
  console.log('OCR Service test completed.');
}

// 运行测试
testOCRService().catch(console.error);