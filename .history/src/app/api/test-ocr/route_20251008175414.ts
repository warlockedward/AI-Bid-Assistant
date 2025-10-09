import { NextRequest } from 'next/server';

export async function GET() {
  return new Response(
    JSON.stringify({ 
      message: 'OCR测试API端点', 
      timestamp: new Date().toISOString(),
      status: 'ok'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body = await request.json();
    
    // 模拟OCR处理
    const result = {
      success: true,
      content: `这是模拟的OCR处理结果，处理了文件: ${body.filename || 'unknown'}`,
      engine_used: body.engine || 'marker-pdf',
      processing_time: Math.random() * 5,
      accuracy: Math.floor(Math.random() * 10) + 90,
    };
    
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: '处理失败',
        details: (error as Error).message 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}