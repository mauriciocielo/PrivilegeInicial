import fetch from 'node-fetch';

const url = "https://novoapi.zappfy.com.br/v1/api/external/5b4c3cc0-b7ef-4101-b417-2fe6a0e35bd7/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MTksInByb2ZpbGUiOiJhZG1pbiIsInNlc3Npb25JZCI6ODAsImNoYW5uZWxUeXBlIjoid2FiYSIsImlhdCI6MTc4NTg3ODEzMiwiZXhwIjoxODQ4OTUwMTMyfQ.30RDtUgJdC3Y3noYx_AMnch6qwS23RInFWq-Y2BA9QY";

const phone = "5511999999999"; // Invalid number just to get 404 (meaning it parsed the payload correctly)

async function testZappfyTemplate() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  const headers = { 'Content-Type': 'application/json' };

  // 1. WhatsApp Cloud API / Zappfy Official format
  const metaPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: "alerta_relatorio_diario",
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "TESTE" }
          ]
        }
      ]
    }
  };

  const res1 = await fetch(url, { method: 'POST', headers, body: JSON.stringify(metaPayload) });
  console.log("Meta Payload Status:", res1.status, await res1.text());

  // 2. Simple Template format (Digisac / Zappfy specific wrapper?)
  const simplePayload = {
    phone: phone,
    template: "alerta_relatorio_diario",
    language: "pt_BR",
    params: ["TESTE"]
  };

  const res2 = await fetch(url, { method: 'POST', headers, body: JSON.stringify(simplePayload) });
  console.log("Simple Payload Status:", res2.status, await res2.text());
}

testZappfyTemplate();
