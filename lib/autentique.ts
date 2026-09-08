// ============================================================
// AUTENTIQUE — assinatura eletrônica de documentos (API v2, GraphQL)
// ============================================================
// SOMENTE SERVIDOR. O token dá poder de criar e apagar documentos na conta do
// escritório, então ele mora em AUTENTIQUE_TOKEN (sem NEXT_PUBLIC_) e nunca
// chega ao navegador: o cliente envia o PDF para a nossa rota, e é a rota que
// conversa com o Autentique.
//
// Sem o token configurado, tudo aqui responde `configurado: false` e a
// funcionalidade some da interface — mesmo padrão adotado para o Sentry.

const ENDPOINT = 'https://api.autentique.com.br/v2/graphql';

export const autentiqueConfigurado = () => Boolean(process.env.AUTENTIQUE_TOKEN);

export type AutentiqueAcao = 'SIGN' | 'SIGN_AS_A_WITNESS' | 'APPROVE' | 'RECOGNIZE';

export interface AutentiqueSigner {
  email: string;
  name?: string;
  action: AutentiqueAcao;
}

export interface AutentiqueAssinatura {
  public_id: string;
  name: string | null;
  email: string | null;
  acao: string | null;
  link: string | null;
  assinadoEm: string | null;
  rejeitadoEm: string | null;
  visualizadoEm: string | null;
}

export interface AutentiqueDocumento {
  id: string;
  name: string;
  assinaturas: AutentiqueAssinatura[];
  arquivoAssinado?: string | null;
}

function token(): string {
  const t = process.env.AUTENTIQUE_TOKEN;
  if (!t) throw new Error('AUTENTIQUE_TOKEN não configurado no servidor.');
  return t;
}

/** Normaliza o formato verboso do Autentique para o que a tela precisa. */
function mapSignatures(signatures: any[]): AutentiqueAssinatura[] {
  return (signatures || []).map((s: any) => ({
    public_id: s?.public_id ?? '',
    name: s?.name ?? s?.user?.name ?? null,
    email: s?.email ?? s?.user?.email ?? null,
    acao: s?.action?.name ?? null,
    link: s?.link?.short_link ?? null,
    assinadoEm: s?.signed?.created_at ?? null,
    rejeitadoEm: s?.rejected?.created_at ?? null,
    visualizadoEm: s?.viewed?.created_at ?? null,
  }));
}

const CAMPOS_ASSINATURA = `
  public_id
  name
  email
  created_at
  action { name }
  link { short_link }
  user { id name email }
  viewed { created_at }
  signed { created_at }
  rejected { created_at }
`;

/**
 * Cria o documento no Autentique e dispara os convites de assinatura.
 * O upload segue a especificação GraphQL multipart request: a variável `file`
 * vai nula no JSON de `operations` e é apontada pelo `map` para a parte binária.
 */
export async function criarDocumentoParaAssinatura(opts: {
  nome: string;
  pdf: Blob;
  nomeArquivo: string;
  signers: AutentiqueSigner[];
  mensagem?: string;
  recusavel?: boolean;
}): Promise<AutentiqueDocumento> {
  const query = `
    mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
        name
        created_at
        signatures { ${CAMPOS_ASSINATURA} }
      }
    }`;

  const variables = {
    document: {
      name: opts.nome,
      ...(opts.mensagem ? { message: opts.mensagem } : {}),
      refusable: opts.recusavel ?? true,
    },
    signers: opts.signers.map(s => ({
      email: s.email,
      ...(s.name ? { name: s.name } : {}),
      action: s.action,
    })),
    file: null,
  };

  const form = new FormData();
  form.append('operations', JSON.stringify({ query, variables }));
  form.append('map', JSON.stringify({ file: ['variables.file'] }));
  form.append('file', opts.pdf, opts.nomeArquivo);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}` },
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.errors) {
    const msg = json?.errors?.[0]?.message || `Autentique respondeu ${res.status}`;
    throw new Error(msg);
  }

  const doc = json?.data?.createDocument;
  if (!doc?.id) throw new Error('O Autentique não retornou o documento criado.');

  return { id: doc.id, name: doc.name, assinaturas: mapSignatures(doc.signatures) };
}

/** Consulta a situação atual das assinaturas de um documento já enviado. */
export async function consultarDocumento(id: string): Promise<AutentiqueDocumento> {
  const query = `
    query($id: UUID!) {
      document(id: $id) {
        id
        name
        files { signed }
        signatures { ${CAMPOS_ASSINATURA} }
      }
    }`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id } }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.errors) {
    const msg = json?.errors?.[0]?.message || `Autentique respondeu ${res.status}`;
    throw new Error(msg);
  }

  const doc = json?.data?.document;
  if (!doc?.id) throw new Error('Documento não encontrado no Autentique.');

  return {
    id: doc.id,
    name: doc.name,
    assinaturas: mapSignatures(doc.signatures),
    arquivoAssinado: doc?.files?.signed ?? null,
  };
}
