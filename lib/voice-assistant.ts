export interface AssistantPersona {
  id: string;
  name: string;
  role: string;
  gender: 'male' | 'female';
  voiceId: string;
  avatarColor: string;
  replyAudioOnAudio: boolean;
  alwaysReplyAudio: boolean;
  customPrompt?: string;
}

export const DEFAULT_ASSISTANTS: AssistantPersona[] = [
  {
    id: 'leo',
    name: 'Léo',
    role: 'Atendente Comercial & Triagem 360º (Privilege Contabilidade)',
    gender: 'male',
    voiceId: 'onyx',
    avatarColor: '#600000',
    replyAudioOnAudio: true,
    alwaysReplyAudio: false,
  },
  {
    id: 'clara',
    name: 'Clara',
    role: 'Assistente Executiva de Voz & Relacionamento (Responde Áudios)',
    gender: 'female',
    voiceId: 'nova',
    avatarColor: '#0f766e',
    replyAudioOnAudio: true,
    alwaysReplyAudio: false,
  },
];

/**
 * Limpa formatação Markdown, URLs longas e excesso de emojis para que a fala em áudio soe natural
 */
export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*+/g, '')
    .replace(/_+/g, '')
    .replace(/https?:\/\/\S+/gi, 'nosso site oficial privilege contabilidade ponto cnt ponto br')
    .replace(/[1-9]️⃣/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transcreve o áudio enviado pelo cliente no WhatsApp usando Gemini Multimodal ou OpenAI Whisper
 */
export async function transcribeWhatsAppAudio(params: {
  mediaUrl: string;
  geminiKey?: string;
  openaiKey?: string;
}): Promise<string | null> {
  const { mediaUrl, geminiKey, openaiKey } = params;
  if (!mediaUrl || !mediaUrl.includes('base64,')) return null;

  const [header, base64Data] = mediaUrl.split('base64,');
  const mimeMatch = header.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1].split(';')[0].trim() : 'audio/ogg';

  // 1. Tenta transcrever via Google Gemini 2.5 Flash (suporta audio/ogg, audio/mp4, audio/mpeg nativamente)
  if (geminiKey && geminiKey.length > 25) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: 'Transcreva exatamente o que o cliente falou neste áudio em português do Brasil. Retorne apenas a transcrição limpa, sem comentários adicionais.',
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (res.ok) {
        const json = await res.json();
        const transcript = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (transcript && transcript.trim()) {
          return transcript.trim();
        }
      }
    } catch (err) {
      console.warn('[VoiceAssistant] Aviso na transcrição Gemini:', err);
    }
  }

  // 2. Tenta transcrever via OpenAI Whisper se houver chave OpenAI configurada
  if (openaiKey && openaiKey.length > 20) {
    try {
      const audioBuffer = Buffer.from(base64Data, 'base64');
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append('file', blob, 'audio.ogg');
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(9000),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.text && json.text.trim()) {
          return json.text.trim();
        }
      }
    } catch (err) {
      console.warn('[VoiceAssistant] Aviso na transcrição OpenAI Whisper:', err);
    }
  }

  return null;
}

/**
 * Converte a resposta do assistente (Léo ou Clara) em áudio falado (MP3 base64) pronto para envio como nota de voz no WhatsApp
 */
export async function synthesizeVoiceReplyPtBr(params: {
  text: string;
  gender?: 'male' | 'female';
  voiceId?: string;
  openaiKey?: string;
}): Promise<{ audioDataUrl: string; mimeType: string } | null> {
  const spokenText = cleanTextForSpeech(params.text);
  if (!spokenText) return null;

  // 1. Se tiver chave da OpenAI configurada, usa o OpenAI TTS HD natural (onyx = masculino Léo / nova = feminino Clara)
  if (params.openaiKey && params.openaiKey.length > 20) {
    try {
      const voice = params.voiceId || (params.gender === 'female' ? 'nova' : 'onyx');
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.openaiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice,
          input: spokenText.slice(0, 900),
          response_format: 'mp3',
          speed: 1.03,
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (res.ok) {
        const arrBuf = await res.arrayBuffer();
        const b64 = Buffer.from(arrBuf).toString('base64');
        return {
          audioDataUrl: `data:audio/mpeg;base64,${b64}`,
          mimeType: 'audio/mp4',
        };
      }
    } catch (err) {
      console.warn('[VoiceAssistant] Falha no OpenAI TTS, usando fallback PT-BR:', err);
    }
  }

  // 2. Motor de Voz PT-BR nativo (sem necessidade de chave externa paga) — divide em frases até 180 chars e concatena MP3
  try {
    const rawChunks = spokenText.match(/[^.!?]+[.!?]*/g) || [spokenText];
    const chunks: string[] = [];

    for (const part of rawChunks) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.length <= 180) {
        chunks.push(trimmed);
      } else {
        const words = trimmed.split(' ');
        let current = '';
        for (const w of words) {
          if ((current + ' ' + w).trim().length > 180) {
            if (current) chunks.push(current.trim());
            current = w;
          } else {
            current = (current + ' ' + w).trim();
          }
        }
        if (current) chunks.push(current.trim());
      }
    }

    const buffers: Buffer[] = [];
    for (const chunk of chunks.slice(0, 5)) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(
        chunk
      )}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        buffers.push(Buffer.from(arr));
      }
    }

    if (buffers.length > 0) {
      const combined = Buffer.concat(buffers);
      return {
        audioDataUrl: `data:audio/mpeg;base64,${combined.toString('base64')}`,
        mimeType: 'audio/mp4',
      };
    }
  } catch (err) {
    console.warn('[VoiceAssistant] Erro ao sintetizar voz PT-BR:', err);
  }

  return null;
}
