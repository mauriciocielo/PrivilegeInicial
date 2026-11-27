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
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
}): Promise<string | null> {
  const { mediaUrl, geminiKey, openaiKey } = params;
  const groqKey = (params.groqKey || process.env.GROQ_API_KEY || '').trim();
  if (!mediaUrl || !mediaUrl.includes('base64,')) return null;

  const [header, base64Data] = mediaUrl.split('base64,');
  const mimeMatch = header.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1].split(';')[0].trim() : 'audio/ogg';

  // 0. Tenta transcrever via Groq Whisper (whisper-large-v3-turbo — gratuito, ultra-rápido e excelente em PT-BR)
  if (groqKey && groqKey.length > 15) {
    try {
      const audioBuffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType.includes('mp4') || mimeType.includes('m4a')
        ? 'm4a'
        : mimeType.includes('mpeg') || mimeType.includes('mp3')
        ? 'mp3'
        : 'ogg';
      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
      form.append('model', 'whisper-large-v3-turbo');
      form.append('language', 'pt');
      form.append('response_format', 'json');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const transcript = typeof json?.text === 'string' ? json.text.trim() : '';
        if (transcript) return transcript;
      }
    } catch (err) {
      console.warn('[VoiceAssistant] Falha na transcrição Groq Whisper:', err);
    }
  }

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

const OPENAI_MALE_VOICES = new Set(['onyx', 'echo', 'ash', 'fable']);
const OPENAI_FEMALE_VOICES = new Set(['nova', 'shimmer', 'alloy', 'coral', 'sage']);
const GEMINI_MALE_VOICES = new Set(['Charon', 'Orus', 'Fenrir', 'Puck', 'Umbriel', 'Algenib', 'Iapetus']);
const GEMINI_FEMALE_VOICES = new Set(['Kore', 'Aoede', 'Leda', 'Zephyr']);

/**
 * Garante que o gênero efetivo respeite o assistente (ex.: Léo sempre masculino)
 */
export function resolveEffectiveGender(params: {
  gender?: 'male' | 'female';
  assistantId?: string;
  assistantName?: string;
}): 'male' | 'female' {
  const idLower = (params.assistantId || '').trim().toLowerCase();
  const nameNorm = (params.assistantName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (idLower === 'leo' || nameNorm === 'leo' || nameNorm.startsWith('leo ')) {
    return 'male';
  }
  if (idLower === 'clara' || nameNorm === 'clara' || nameNorm.startsWith('clara ')) {
    return 'female';
  }
  return params.gender === 'female' ? 'female' : 'male';
}

function resolveOpenAIVoice(gender: 'male' | 'female', voiceId?: string): string {
  const v = (voiceId || '').trim().toLowerCase();
  if (gender === 'male') {
    return OPENAI_MALE_VOICES.has(v) ? v : 'onyx';
  }
  return OPENAI_FEMALE_VOICES.has(v) ? v : 'nova';
}

function resolveGeminiVoice(gender: 'male' | 'female', voiceId?: string): string {
  const v = (voiceId || '').trim();
  if (gender === 'male') {
    return GEMINI_MALE_VOICES.has(v) ? v : 'Charon';
  }
  return GEMINI_FEMALE_VOICES.has(v) ? v : 'Kore';
}

async function encodePcm16ToMp3Buffer(pcmBuffer: Buffer, sampleRate = 24000): Promise<Buffer> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const sampleCount = Math.floor(pcmBuffer.byteLength / 2);
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, sampleCount);
  const encoder = new Mp3Encoder(1, sampleRate, 96);
  const mp3Chunks: Buffer[] = [];
  const blockSize = 1152;

  for (let i = 0; i < samples.length; i += blockSize) {
    const slice = samples.subarray(i, i + blockSize);
    const encoded = encoder.encodeBuffer(slice);
    if (encoded.length > 0) {
      mp3Chunks.push(Buffer.from(encoded));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Chunks.push(Buffer.from(flushed));
  }

  return Buffer.concat(mp3Chunks);
}

/**
 * Converte a resposta do assistente (Léo ou Clara) em áudio falado (MP3 base64) pronto para envio como nota de voz no WhatsApp
 */
export async function synthesizeVoiceReplyPtBr(params: {
  text: string;
  gender?: 'male' | 'female';
  voiceId?: string;
  assistantId?: string;
  assistantName?: string;
  openaiKey?: string;
  geminiKey?: string;
}): Promise<{ audioDataUrl: string; mimeType: string } | null> {
  const spokenText = cleanTextForSpeech(params.text);
  if (!spokenText) return null;

  const effectiveGender = resolveEffectiveGender({
    gender: params.gender,
    assistantId: params.assistantId,
    assistantName: params.assistantName,
  });

  // 1. Se tiver chave da OpenAI configurada, usa o OpenAI TTS HD natural (onyx = masculino Léo / nova = feminino Clara)
  if (params.openaiKey && params.openaiKey.length > 20) {
    try {
      const voice = resolveOpenAIVoice(effectiveGender, params.voiceId);
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
      console.warn('[VoiceAssistant] Falha no OpenAI TTS, tentando Gemini TTS:', err);
    }
  }

  // 2. Gemini 2.5 Flash Preview TTS nativo (suporta voz masculina Charon para o Léo e feminina Kore para a Clara)
  if (params.geminiKey && params.geminiKey.length > 25) {
    try {
      const geminiVoice = resolveGeminiVoice(effectiveGender, params.voiceId);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${params.geminiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Fale exatamente o texto abaixo em português do Brasil, com entonação natural, cordial e executiva:\n\n${spokenText.slice(0, 900)}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: geminiVoice,
                },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const json = await res.json();
        const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
          const rawBuf = Buffer.from(inlineData.data, 'base64');
          const inlineMime = String(inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000').toLowerCase();

          let mp3Buffer: Buffer;
          if (inlineMime.includes('mp3') || inlineMime.includes('mpeg')) {
            mp3Buffer = rawBuf;
          } else {
            const rateMatch = inlineMime.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
            mp3Buffer = await encodePcm16ToMp3Buffer(rawBuf, sampleRate);
          }

          if (mp3Buffer.length > 0) {
            return {
              audioDataUrl: `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`,
              mimeType: 'audio/mp4',
            };
          }
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn('[VoiceAssistant] Gemini TTS retornou erro:', res.status, errText.slice(0, 200));
      }
    } catch (err) {
      console.warn('[VoiceAssistant] Falha no Gemini TTS, usando fallback PT-BR:', err);
    }
  }

  // 3. Motor de Voz PT-BR fallback (sem chave externa — apenas voz feminina padrão do Google Translate)
  if (effectiveGender === 'male') {
    console.warn('[VoiceAssistant] Aviso: usando fallback PT-BR sem chave Gemini/OpenAI; voz masculina requer GEMINI_API_KEY ou OPENAI_API_KEY.');
  }
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
