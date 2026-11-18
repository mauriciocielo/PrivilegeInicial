import { NextRequest, NextResponse } from 'next/server';
import { getComercialData, saveComercialSection } from '@/lib/comercial-store';

export const dynamic = 'force-dynamic';

const DEFAULT_QUESTIONS = [
  { id: 1, categoria: 'Ambiente e Estrutura', texto: 'A infraestrutura para seu trabalho é adequada (equipamentos, maquinário, mobiliaria)?' },
  { id: 2, categoria: 'Ambiente e Estrutura', texto: 'A carga horária do trabalho está adequada para realizar os trabalhos com qualidade?' },
  { id: 3, categoria: 'Ambiente e Estrutura', texto: 'A infraestrutura para comodidade e conforto (refeitório, descanso, higiene) é adequada?' },
  { id: 4, categoria: 'Ambiente e Estrutura', texto: 'Os objetivos e metas da empresa estão claros para mim?' },
  { id: 5, categoria: 'Ambiente e Estrutura', texto: 'Sei claramente quais são as metas/objetivos da minha área?' },
  { id: 6, categoria: 'Comportamento', texto: 'Você possui uma relação de fácil comunicação com sua equipe de trabalho?' },
  { id: 7, categoria: 'Comportamento', texto: 'Você possui uma relação de fácil comunicação com outros departamentos/setores?' },
  { id: 8, categoria: 'Comportamento', texto: 'É tratado de forma respeitosa pelos colegas de trabalho?' },
  { id: 9, categoria: 'Comportamento', texto: 'Você se sente estimulado para o trabalho em equipe?' },
  { id: 10, categoria: 'Comportamento', texto: 'Durante seu dia de trabalho você está 100% focado em suas atividades?' },
  { id: 11, categoria: 'Comportamento', texto: 'Durante seu dia de trabalho há distrações? (Uso de celular / conversas / brincadeiras)' },
  { id: 12, categoria: 'Desenvolvimento Profissional', texto: 'As promoções e reconhecimento que acontecem na empresa são justas e bem fundamentadas?' },
  { id: 13, categoria: 'Desenvolvimento Profissional', texto: 'Seu potencial de trabalho está sendo aproveitado de forma adequada na sua área?' },
  { id: 14, categoria: 'Desenvolvimento Profissional', texto: 'Suas sugestões são avaliadas pelo seu gestor?' },
  { id: 15, categoria: 'Desenvolvimento Profissional', texto: 'Você visualiza oportunidades de crescimento profissional na empresa?' },
  { id: 16, categoria: 'Desenvolvimento Profissional', texto: 'Sente prazer pelo trabalho que faz?' },
  { id: 17, categoria: 'Desenvolvimento Profissional', texto: 'A empresa oferece um treinamento adequado quando necessário?' },
  { id: 18, categoria: 'Desenvolvimento Profissional', texto: 'Recebe elogios pelo seu trabalho?' },
  { id: 19, categoria: 'Desenvolvimento Profissional', texto: 'Você tem oportunidade de aprendizado e desenvolvimento profissional na empresa?' },
  { id: 20, categoria: 'Desenvolvimento Profissional', texto: 'Você é realizado profissionalmente com o cargo?' },
  { id: 21, categoria: 'Gestão e Liderança', texto: 'Meu gestor direto mostra-se próximo e preocupado com o bem estar do time?' },
  { id: 22, categoria: 'Gestão e Liderança', texto: 'Você tem uma boa comunicação com seu gestor?' },
  { id: 23, categoria: 'Gestão e Liderança', texto: 'Seu gestor possui as competências necessárias para a função?' },
  { id: 24, categoria: 'Gestão e Liderança', texto: 'Confia que as decisões tomadas pelo gestor direto são adequadas para alcançar o resultado proposto?' },
  { id: 25, categoria: 'Gestão e Liderança', texto: 'Meu gestor direto fornece o direcionamento necessário para que eu realize meu trabalho da melhor forma?' },
  { id: 26, categoria: 'Gestão e Liderança', texto: 'Sinto segurança em falar sobre erros, dificuldades e frustrações relacionadas ao trabalho com meu líder?' },
  { id: 27, categoria: 'Gestão e Liderança', texto: 'Seu desempenho profissional é avaliado de forma adequada?' },
  { id: 28, categoria: 'Imagem da Empresa', texto: 'A empresa oferece ótimas soluções para seus clientes?' },
  { id: 29, categoria: 'Imagem da Empresa', texto: 'Sente seguro em relação a estabilidade no emprego?' },
  { id: 30, categoria: 'Imagem da Empresa', texto: 'Indicaria um amigo para trabalhar na empresa?' },
  { id: 31, categoria: 'Imagem da Empresa', texto: 'A empresa é um bom lugar para trabalhar?' },
  { id: 32, categoria: 'Remuneração e Beneficios', texto: 'Os benefícios oferecidos estão compatíveis com suas necessidades pessoais?' },
  { id: 33, categoria: 'Remuneração e Beneficios', texto: 'Sua remuneração atende suas necessidades pessoais?' },
  { id: 34, categoria: 'Remuneração e Beneficios', texto: 'Minhas responsabilidades estão alinhadas com minha remuneração (salário)?' },
  { id: 35, categoria: 'Cultura', texto: 'Acredito que o propósito e valores da empresa estão alinhados com os meus?' },
  { id: 36, categoria: 'Cultura', texto: 'Penso que não existe diferença entre o discurso e prática na empresa?' },
  { id: 37, categoria: 'Cultura', texto: 'Há um grande empenho de todos da empresa para se ajudar para atingir o resultado coletivo?' },
  { id: 38, categoria: 'Cultura', texto: 'Considero que de modo geral as pessoas desta empresa têm um bom relacionamento entre si?' },
  { id: 39, categoria: 'Cultura', texto: 'A empresa desenvolve ações com o objetivo de proporcionar o bem estar das pessoas?' },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresaId') || 'default';
    const data = await getComercialData(empresaId);
    const clima = data?.pessoas_clima || {};
    const questions =
      Array.isArray(clima.questions) && clima.questions.length > 0
        ? clima.questions
        : DEFAULT_QUESTIONS;

    return NextResponse.json({
      success: true,
      empresaId,
      questions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao carregar pesquisa' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const empresaId = String(body.empresaId || 'default');
    const notas = body.notas && typeof body.notas === 'object' ? body.notas : null;
    if (!notas || Object.keys(notas).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Respostas inválidas.' },
        { status: 400 }
      );
    }

    const data = await getComercialData(empresaId);
    const current = data?.pessoas_clima || {};
    const questions =
      Array.isArray(current.questions) && current.questions.length > 0
        ? current.questions
        : DEFAULT_QUESTIONS;
    const existingResponses = Array.isArray(current.responses) ? current.responses : [];

    const novo = {
      id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      respondente: String(body.respondente || '').trim() || `Colaborador ${existingResponses.length + 1}`,
      setor: String(body.setor || '').trim() || 'Geral',
      data: new Date().toISOString().slice(0, 10),
      notas,
    };

    const nextValue = {
      questions,
      responses: [...existingResponses, novo],
      parecer: typeof current.parecer === 'string' ? current.parecer : '',
    };

    await saveComercialSection(empresaId, 'pessoas_clima', nextValue);
    return NextResponse.json({ success: true, id: novo.id });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao enviar pesquisa' },
      { status: 500 }
    );
  }
}
