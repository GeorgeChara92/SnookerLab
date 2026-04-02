export const getYoutubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

export const getYoutubeThumbnailUrl = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

export const getYoutubeEmbedUrl = (videoId: string) =>
  `https://www.youtube-nocookie.com/embed/${videoId}`;

export const getPrimaryYoutubeId = (videoId?: string, altVideoId?: string) => videoId ?? altVideoId;
