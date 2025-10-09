import { NextRequest } from 'next/server';

// Python后端服务地址
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const path = params.path.join('/');
    const url = `${PYTHON_BACKEND_URL}/${path}${request.nextUrl.search}`;
    
    // 转发GET请求到Python后端
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries()),
      },
    });

    // 返回Python后端的响应
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('API代理错误:', error);
    return new Response(
      JSON.stringify({ error: 'API代理失败', details: (error as Error).message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const path = params.path.join('/');
    const url = `${PYTHON_BACKEND_URL}/${path}`;
    
    // 获取请求体
    const body = await request.text();
    
    // 转发POST请求到Python后端
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...Object.fromEntries(request.headers.entries()),
      },
      body: request.headers.get('content-type')?.includes('multipart/form-data') 
        ? body as any
        : body,
    });

    // 返回Python后端的响应
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      });
    }
  } catch (error) {
    console.error('API代理错误:', error);
    return new Response(
      JSON.stringify({ error: 'API代理失败', details: (error as Error).message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}