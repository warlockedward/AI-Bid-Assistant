
# OCR功能测试指南

## 概述
本文档说明如何测试系统中的OCR功能，包括前后端集成测试和独立测试。

## 测试环境准备

1. 确保Python后端服务正在运行：
---
```bash
   cd python-backend
   python main.py
```
---

2. 确保前端服务正在运行：
---
```bash
   npm run dev
```
---

## OCR功能测试步骤

### 1. 测试API端点
---
```bash
# 测试OCR配置获取
curl -X GET http://localhost:8000/api/ocr/config

# 测试可用引擎列表
curl -X GET http://localhost:8000/api/ocr/engines
```
---

### 2. 前端测试页面
访问以下URL进行前端测试：
---
```
http://localhost:3000/test-ocr
```
---

在测试页面中，您可以：
- 查看OCR配置信息
- 选择不同的OCR引擎
- 上传文件进行OCR处理
- 查看处理结果

### 3. 项目创建流程测试
1. 访问项目创建页面
2. 上传PDF文件
3. 选择OCR引擎
4. 观察OCR处理过程和结果

## 支持的OCR引擎

1. **MinerU** - 专业的PDF文档解析工具
   - 准确率: 95%
   - 速度: 中等
   - 支持格式: PDF, DOC, DOCX

2. **Marker PDF** - 快速PDF解析引擎
   - 准确率: 92%
   - 速度: 快速
   - 支持格式: PDF

3. **OLM OCR** - 光学字符识别引擎
   - 准确率: 97%
   - 速度: 慢速
   - 支持格式: PDF, JPG, PNG, TIFF

## 故障排除

### 1. API代理问题
如果前端无法连接到Python后端，请检查：
- Python后端是否正在运行
- 环境变量PYTHON_BACKEND_URL是否正确设置
- 网络连接是否正常

### 2. OCR处理失败
如果OCR处理失败，请检查：
- 上传的文件格式是否支持
- 选择的OCR引擎是否可用
- Python后端OCR服务是否正常工作

### 3. 测试模式
在开发环境中，可以通过设置OCR_TEST_MODE=true来启用测试模式，使用模拟数据进行测试。

## 性能监控

系统会记录以下性能指标：
- OCR处理时间
- 识别准确率
- 引擎使用情况
- 错误统计

这些信息可以通过监控页面查看。