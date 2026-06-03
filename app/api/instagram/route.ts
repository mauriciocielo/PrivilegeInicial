import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  // Fallback mock posts (high-quality visual data matching custom client design)
  const fallbackPosts = [
    {
      id: 'mock_1',
      media_url: '/edificio_privilege.jpg',
      permalink: 'https://www.instagram.com/privilgefb',
      caption: 'Nosso compromisso é com a segurança patrimonial e a clareza tributária do seu negócio. Venha tomar um café em nossa sede!',
      timestamp: new Date().toISOString()
    },
    {
      id: 'mock_2',
      media_url: '/finance_abstract.png',
      permalink: 'https://www.instagram.com/privilgefb',
      caption: 'Você sabe como o BPO Financeiro atua no caixa da sua empresa? Descubra o método Privilege de gerenciamento financeiro avançado.',
      timestamp: new Date().toISOString()
    },
    {
      id: 'mock_3',
      media_url: '/logo.png',
      permalink: 'https://www.instagram.com/privilgefb',
      caption: 'Excelência técnica e assessoria focada no crescimento da sua marca. Siga o nosso perfil oficial para novidades tributárias!',
      timestamp: new Date().toISOString(),
      useDarkBg: true
    }
  ];

  if (!token) {
    return NextResponse.json({ data: fallbackPosts, isMock: true });
  }

  try {
    const res = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&access_token=${token}&limit=6`,
      { next: { revalidate: 3600 } } // Cache for 1 hour to prevent rate limiting
    );

    if (!res.ok) {
      console.warn("Instagram API responded with error, falling back to mock posts");
      return NextResponse.json({ data: fallbackPosts, isMock: true });
    }

    const data = await res.json();
    if (data && data.data && data.data.length > 0) {
      // Map response to match feed structure
      const posts = data.data.map((item: any) => ({
        id: item.id,
        media_url: item.media_type === 'VIDEO' ? item.thumbnail_url || item.media_url : item.media_url,
        permalink: item.permalink,
        caption: item.caption || '',
        timestamp: item.timestamp
      }));
      return NextResponse.json({ data: posts, isMock: false });
    }

    return NextResponse.json({ data: fallbackPosts, isMock: true });
  } catch (error) {
    console.error("Failed to fetch Instagram feed:", error);
    return NextResponse.json({ data: fallbackPosts, isMock: true });
  }
}
