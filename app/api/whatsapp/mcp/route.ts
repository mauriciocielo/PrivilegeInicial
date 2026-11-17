import { NextRequest, NextResponse } from 'next/server';
import { MCP_TOOLS_MANIFEST, executeMcpTool, generateGeminiBotReply, updateWhatsAppConfig } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID, X-Requested-With',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function jsonWithCors(data: any, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...CORS_HEADERS,
      ...(extraHeaders || {}),
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function DELETE() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const format = searchParams.get('format');
  const accept = req.headers.get('accept') || '';

  // Suporte a SSE (MCP Legacy SSE / Streamable HTTP GET)
  if (accept.includes('text/event-stream')) {
    const encoder = new TextEncoder();
    const sessionId = req.headers.get('mcp-session-id') || `mcp_${Date.now()}`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: endpoint\ndata: /api/whatsapp/mcp?sessionId=${sessionId}\n\n`)
        );
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(keepAlive);
          }
        }, 15000);
      },
    });
    return new NextResponse(stream, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Mcp-Session-Id': sessionId,
      },
    });
  }

  if (format === 'openapi') {
    return jsonWithCors({
      openapi: '3.1.0',
      info: {
        title: 'Privilege WhatsApp & Assistente Léo API (ChatGPT Actions / MCP)',
        description:
          'Permite ao ChatGPT, Claude e Gemini ler conversas do WhatsApp, responder clientes, agendar follow-ups no CRM e treinar o assistente Léo da Privilege Contabilidade.',
        version: '1.0.0',
      },
      servers: [{ url: origin }],
      paths: {
        '/api/whatsapp/mcp': {
          post: {
            operationId: 'executeWhatsAppTool',
            summary: 'Executa uma ferramenta de WhatsApp, CRM ou treinamento do Assistente Léo',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tool: {
                        type: 'string',
                        enum: MCP_TOOLS_MANIFEST.map(t => t.name),
                        description: 'Nome da ferramenta a executar',
                      },
                      arguments: {
                        type: 'object',
                        description: 'Parâmetros da ferramenta selecionada',
                      },
                    },
                    required: ['tool'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Resultado da ferramenta executada',
              },
            },
          },
        },
      },
    });
  }

  return jsonWithCors({
    success: true,
    protocol: 'mcp-1.0',
    server: 'Privilege WhatsApp MCP Server (Gemini, Claude & ChatGPT Ready)',
    version: '1.0.0',
    description: 'Model Context Protocol Server for WhatsApp (Streamable HTTP + JSON-RPC 2.0)',
    tools: MCP_TOOLS_MANIFEST,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Suporte a lote JSON-RPC 2.0 (batch requests)
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        const res = await handleJsonRpcItem(item, req);
        if (res) results.push(res);
      }
      return jsonWithCors(results);
    }

    // Teste direto de conexão de provedor de IA (Claude, ChatGPT ou Gemini)
    if (body.action === 'test_ai_connection') {
      if (body.configUpdates) {
        await updateWhatsAppConfig(body.configUpdates);
      }
      const start = Date.now();
      const reply = await generateGeminiBotReply(
        'Olá! Confirme em 1 frase curta que você é o assistente Léo da Privilege Contabilidade e que sua conexão está ativa.'
      );
      return jsonWithCors({
        success: true,
        reply,
        durationMs: Date.now() - start,
      });
    }

    // Suporte ao protocolo oficial MCP JSON-RPC 2.0 (Gemini, Claude Desktop, Cursor, Antigravity)
    if (body.jsonrpc === '2.0' || body.method) {
      const sessionId = req.headers.get('mcp-session-id') || `mcp_${Date.now()}`;
      const rpcRes = await handleJsonRpcItem(body, req);
      if (rpcRes === null) {
        return new NextResponse(null, {
          status: 202,
          headers: { ...CORS_HEADERS, 'Mcp-Session-Id': sessionId },
        });
      }
      return jsonWithCors(rpcRes, rpcRes.error ? 400 : 200, { 'Mcp-Session-Id': sessionId });
    }

    // Suporte ao formato REST direto: { tool: '...', arguments: { ... } }
    const tool = body.tool || body.name;
    const args = body.arguments || body.args || {};

    if (!tool) {
      return jsonWithCors({ success: false, error: 'Parâmetro "tool" ou "name" é obrigatório' }, 400);
    }

    const result = await executeMcpTool(tool, args);
    return jsonWithCors({ success: true, tool, result });
  } catch (error: any) {
    return jsonWithCors({ success: false, error: error.message }, 500);
  }
}

async function handleJsonRpcItem(body: any, _req: NextRequest): Promise<any | null> {
  const id = body.id;
  const method = String(body.method || '');

  // Notificações JSON-RPC (sem id) como notifications/initialized devem retornar 202 sem corpo
  if (method.startsWith('notifications/') || (id === undefined && method === 'initialized')) {
    return null;
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id: id ?? 1, result: {} };
  }

  if (method === 'initialize') {
    const clientVersion = body.params?.protocolVersion;
    const protocolVersion =
      clientVersion === '2025-03-26' || clientVersion === '2025-06-18'
        ? clientVersion
        : '2024-11-05';
    return {
      jsonrpc: '2.0',
      id: id ?? 1,
      result: {
        protocolVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: 'privilege-whatsapp-mcp',
          version: '1.0.0',
        },
      },
    };
  }

  if (method === 'tools/list' || method === 'mcp/list_tools') {
    return {
      jsonrpc: '2.0',
      id: id ?? 1,
      result: {
        tools: MCP_TOOLS_MANIFEST.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.parameters,
        })),
      },
    };
  }

  if (method === 'resources/list') {
    return { jsonrpc: '2.0', id: id ?? 1, result: { resources: [] } };
  }

  if (method === 'prompts/list') {
    return { jsonrpc: '2.0', id: id ?? 1, result: { prompts: [] } };
  }

  if (method === 'tools/call' || method === 'mcp/call_tool') {
    const toolName = body.params?.name;
    const toolArgs = body.params?.arguments || {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id: id ?? 1,
        error: { code: -32602, message: 'Missing tool name in params' },
      };
    }

    const result = await executeMcpTool(toolName, toolArgs);
    return {
      jsonrpc: '2.0',
      id: id ?? 1,
      result: {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id: id ?? 1,
    error: { code: -32601, message: `Method "${method}" not found` },
  };
}
