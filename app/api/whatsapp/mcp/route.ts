import { NextRequest, NextResponse } from 'next/server';
import { MCP_TOOLS_MANIFEST, executeMcpTool, generateGeminiBotReply, updateWhatsAppConfig } from '@/lib/whatsapp-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const format = searchParams.get('format');

  if (format === 'openapi') {
    return NextResponse.json({
      openapi: '3.1.0',
      info: {
        title: 'Privilege WhatsApp & Assistente Léo API (ChatGPT Actions / MCP)',
        description:
          'Permite ao ChatGPT e ao Claude ler conversas do WhatsApp, responder clientes, agendar follow-ups no CRM e treinar o assistente Léo da Privilege Contabilidade.',
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

  return NextResponse.json({
    success: true,
    protocol: 'mcp-1.0',
    server: 'Privilege WhatsApp MCP Server (Claude & ChatGPT Ready)',
    version: '1.0.0',
    description: 'Model Context Protocol Server for WhatsApp (compatible with lharries/whatsapp-mcp, Claude Desktop, and ChatGPT Actions)',
    tools: MCP_TOOLS_MANIFEST,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Teste direto de conexão de provedor de IA (Claude, ChatGPT ou Gemini)
    if (body.action === 'test_ai_connection') {
      if (body.configUpdates) {
        await updateWhatsAppConfig(body.configUpdates);
      }
      const start = Date.now();
      const reply = await generateGeminiBotReply(
        'Olá! Confirme em 1 frase curta que você é o assistente Léo da Privilege Contabilidade e que sua conexão está ativa.'
      );
      return NextResponse.json({
        success: true,
        reply,
        durationMs: Date.now() - start,
      });
    }

    // Suporte ao protocolo oficial MCP JSON-RPC 2.0 (Claude Desktop / Cursor / Agents)
    if (body.jsonrpc === '2.0' || body.method) {
      const id = body.id ?? 1;

      // 1. Descoberta de ferramentas (tools/list)
      if (body.method === 'tools/list' || body.method === 'mcp/list_tools') {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS_MANIFEST.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.parameters,
            })),
          },
        });
      }

      // 2. Execução de ferramentas (tools/call)
      if (body.method === 'tools/call' || body.method === 'mcp/call_tool') {
        const toolName = body.params?.name;
        const toolArgs = body.params?.arguments || {};

        if (!toolName) {
          return NextResponse.json(
            { jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing tool name in params' } },
            { status: 400 }
          );
        }

        const result = await executeMcpTool(toolName, toolArgs);
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
            data: result,
          },
        });
      }

      // 3. Handshake inicial (initialize)
      if (body.method === 'initialize') {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'privilege-whatsapp-mcp',
              version: '1.0.0',
            },
          },
        });
      }

      return NextResponse.json(
        { jsonrpc: '2.0', id, error: { code: -32601, message: `Method "${body.method}" not found` } },
        { status: 404 }
      );
    }

    // Suporte ao formato REST direto: { tool: '...', arguments: { ... } }
    const tool = body.tool || body.name;
    const args = body.arguments || body.args || {};

    if (!tool) {
      return NextResponse.json({ success: false, error: 'Parâmetro "tool" ou "name" é obrigatório' }, { status: 400 });
    }

    const result = await executeMcpTool(tool, args);
    return NextResponse.json({ success: true, tool, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
