import * as VideoThumbnails from 'expo-video-thumbnails';

export type VideoThumbnailResult = {
  uri: string;
  width?: number;
  height?: number;
};

export class VideoThumbnailError extends Error {
  code: 'generation_failed';

  constructor(message: string) {
    super(message);
    this.name = 'VideoThumbnailError';
    this.code = 'generation_failed';
  }
}

export async function generateVideoThumbnailForMessaging(videoUri: string): Promise<VideoThumbnailResult> {
  if (!videoUri) {
    throw new VideoThumbnailError('Video URI is required for thumbnail generation.');
  }

  try {
    const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 300,
      quality: 0.7,
    });

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    throw new VideoThumbnailError(
      error instanceof Error ? error.message : 'Unable to generate video thumbnail.',
    );
  }
}

