const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const target1 = '  nfeManifestacoes           NfeManifestacaoEvento[]\n}';
const target1CRLF = '  nfeManifestacoes           NfeManifestacaoEvento[]\r\n}';

const replacement1 = '  nfeManifestacoes           NfeManifestacaoEvento[]\n  certidoesFiscais           CertidaoFiscal[]\n  certidaoConfig             CertidaoConfig?\n}';
const replacement1CRLF = '  nfeManifestacoes           NfeManifestacaoEvento[]\r\n  certidoesFiscais           CertidaoFiscal[]\r\n  certidaoConfig             CertidaoConfig?\r\n}';

if (schema.includes(target1CRLF)) {
  schema = schema.replace(target1CRLF, replacement1CRLF);
} else if (schema.includes(target1)) {
  schema = schema.replace(target1, replacement1);
} else {
  console.error('Target 1 not found!');
  process.exit(1);
}

const models = `

model CertidaoFiscal {
  id                    String    @id @default(uuid())
  empresaId             String
  tipo                  String    // "FEDERAL", "ESTADUAL", "MUNICIPAL", "TRABALHISTA", "FGTS"
  uf                    String?   // "PR", "SC", "SP", etc.
  situacao              String    // "NEGATIVA", "POSITIVA_COM_EFEITO_NEGATIVA", "POSITIVA", "PROCESSANDO", "ERRO"
  protocolo             String?
  codigoAutenticidade   String?
  numeroCertidao        String?
  emitidoEm             DateTime?
  validoAte             DateTime?
  pdfBase64             String?   @db.Text
  pendencias            Json?
  observacoes           String?
  criadoAutomaticamente Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  empresa               Empresa   @relation(fields: [empresaId], references: [id], onDelete: Cascade)

  @@index([empresaId, tipo])
  @@index([empresaId, createdAt])
}

model CertidaoConfig {
  id                           String    @id @default(uuid())
  empresaId                    String?   @unique
  ativo                        Boolean   @default(true)
  executarUltimoDia            Boolean   @default(true)
  diaDoMes                     Int?      @default(0) // 0 = ultimo dia do mes
  horario                      String    @default("23:00")
  consultarFederal             Boolean   @default(true)
  consultarEstadual            Boolean   @default(true)
  notificarEmail               Boolean   @default(true)
  emailsNotificacao            String?   // emails separados por virgula
  notificarApenasComPendencias Boolean   @default(true)
  ultimaExecucaoEm             DateTime?
  statusUltimaExecucao         String?
  detalhesUltimaExecucao       Json?
  createdAt                    DateTime  @default(now())
  updatedAt                    DateTime  @updatedAt
  empresa                      Empresa?  @relation(fields: [empresaId], references: [id], onDelete: Cascade)
}
`;

schema = schema + models;
fs.writeFileSync('prisma/schema.prisma', schema, 'utf8');
console.log('Schema updated successfully.');

