#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Definir as ferramentas disponíveis
const TOOLS: Tool[] = [
  {
    name: "echo",
    description: "Retorna o texto fornecido (ferramenta de exemplo)",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Mensagem para ecoar",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "get_time",
    description: "Retorna a data e hora atual",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "calculate",
    description: "Realiza operações matemáticas básicas",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "Operação a ser realizada",
        },
        a: {
          type: "number",
          description: "Primeiro número",
        },
        b: {
          type: "number",
          description: "Segundo número",
        },
      },
      required: ["operation", "a", "b"],
    },
  },
];

// Criar servidor MCP
const server = new Server(
  {
    name: "example-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler para listar ferramentas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handler para executar ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "echo": {
        const message = args?.message as string;
        return {
          content: [
            {
              type: "text",
              text: `Echo: ${message}`,
            },
          ],
        };
      }

      case "get_time": {
        const now = new Date();
        return {
          content: [
            {
              type: "text",
              text: `Data e hora atual: ${now.toLocaleString("pt-BR")}`,
            },
          ],
        };
      }

      case "calculate": {
        const { operation, a, b } = args as {
          operation: string;
          a: number;
          b: number;
        };

        let result: number;
        switch (operation) {
          case "add":
            result = a + b;
            break;
          case "subtract":
            result = a - b;
            break;
          case "multiply":
            result = a * b;
            break;
          case "divide":
            if (b === 0) {
              throw new Error("Divisão por zero não é permitida");
            }
            result = a / b;
            break;
          default:
            throw new Error(`Operação desconhecida: ${operation}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Resultado: ${a} ${operation} ${b} = ${result}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Erro: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Servidor MCP iniciado e aguardando conexões...");
}

main().catch((error) => {
  console.error("Erro ao iniciar servidor:", error);
  process.exit(1);
});
