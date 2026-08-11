import fetch from 'node-fetch';

const url = "https://novoapi.zappfy.com.br/v1/api/external/5b4c3cc0-b7ef-4101-b417-2fe6a0e35bd7/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MTksInByb2ZpbGUiOiJhZG1pbiIsInNlc3Npb25JZCI6ODAsImNoYW5uZWxUeXBlIjoid2FiYSIsImlhdCI6MTc4NTg3ODEzMiwiZXhwIjoxODQ4OTUwMTMyfQ.30RDtUgJdC3Y3noYx_AMnch6qwS23RInFWq-Y2BA9QY";

async function testZappfy() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // try pattern 1 (Z-API style)
  console.log("TRYING PATTERN 1");
  const res1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: "5546999999999", message: "Teste 1" })
  });
  console.log("RES 1 status:", res1.status, await res1.text());

  // try pattern 2 (Evolution style)
  console.log("TRYING PATTERN 2");
  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: "5546999999999", text: "Teste 2" })
  });
  console.log("RES 2 status:", res2.status, await res2.text());
  
  // try pattern 3 (Many SaaS custom external)
  console.log("TRYING PATTERN 3");
  const res3 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cellPhone: "5546999999999", message: "Teste 3", type: "text" })
  });
  console.log("RES 3 status:", res3.status, await res3.text());
}

testZappfy();
