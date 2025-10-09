# AutoGen投标系统后端

基于AutoGen框架的多租户智能投标系统后端。

## 功能特性

- 🏢 多租户架构，数据隔离
- 🤖 基于AutoGen的智能体协作
- 📊 招标文档智能分析
- 🔍 知识检索与RAG集成
- ✍️ 内容生成与合规验证
- 🔄 人工反馈循环
- 🔒 安全认证与权限控制

## 系统架构

```
Frontend (Next.js) ←→ FastAPI Backend ←→ AutoGen Agents
    ↓                      ↓                    ↓
  React UI              API Gateway      Tender Analysis
  Shadcn UI             Authentication   Knowledge Retrieval
  Real-time Updates     Tenant Mgmt      Content Generation
  Human Review          Workflow Mgmt    Compliance Verification
```

## 快速开始

### 环境要求

- Python 3.11+
- PostgreSQL 13+
- OpenAI API Key

### 安装步骤

1. 克隆项目并进入后端目录
```bash
cd python-backend
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

4. 启动开发服务器
```bash
python main.py
```

### API文档

启动服务后访问: http://localhost:8000/docs

## 核心组件

### 智能体架构

系统包含四个核心智能体：

1. **招标分析代理** - 分析招标文档，提取关键需求
2. **知识检索代理** - 从FastGPT RAG系统检索相关知识
3. **内容生成代理** - 生成投标方案内容
4. **合规验证代理** - 验证方案合规性

### 工作流管理

- 智能体协作通过AutoGen GroupChat实现
- 支持实时状态监控
- 人工反馈集成
- 多租户隔离

## 开发指南

### 添加新的智能体

1. 在 `agents/` 目录创建新的代理类
2. 继承 `autogen.AssistantAgent`
3. 实现必要的功能方法
4. 在 `agent_manager.py` 中集成

### 配置管理

所有配置通过 `config.py` 管理，支持环境变量覆盖。

### 测试

```bash
# 运行测试
pytest tests/

# 代码质量检查
flake8 .
mypy .
```

## 部署

### Docker部署

```bash
docker build -t autogen-bid-backend .
docker run -p 8000:8000 autogen-bid-backend
```

### 生产环境配置

- 设置 `DEBUG=false`
- 配置正确的数据库连接
- 设置强密码和密钥
- 启用HTTPS

## 许可证

MIT License