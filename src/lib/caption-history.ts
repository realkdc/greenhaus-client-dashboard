import { adminDb } from "@/lib/firebaseAdmin";

export interface CaptionHistoryEntry {
  id?: string;
  caption: string;
  hook?: string; // Extracted hook (first sentence or phrase)
  cta?: string; // Extracted CTA (phrase before hashtags)
  createdAt: Date;
  imageUrls?: string[];
  contentName?: string;
}

// Extract hook from caption (typically first sentence before first period or emoji)
function extractHook(caption: string): string | undefined {
  // Try to find the hook - usually the first sentence or phrase
  // Look for first sentence ending with period, or first phrase before emoji
  const firstPeriod = caption.indexOf('.');
  const firstEmoji = caption.search(/[✨🍃🍋🌿🔥🛎️😌☀️🌙🧊📖☕]/);
  
  if (firstPeriod > 0 && firstPeriod < 100) {
    return caption.substring(0, firstPeriod + 1).trim();
  }
  
  if (firstEmoji > 0 && firstEmoji < 100) {
    return caption.substring(0, firstEmoji).trim();
  }
  
  // Fallback: first 50 characters
  if (caption.length > 50) {
    return caption.substring(0, 50).trim() + '...';
  }
  
  return caption.substring(0, 30).trim() + '...';
}

// Extract CTA from caption (phrase before hashtags, typically contains "GreenHaus" and ends with "21+")
function extractCTA(caption: string): string | undefined {
  // Look for hashtag marker
  const hashtagIndex = caption.indexOf('#');
  if (hashtagIndex === -1) return undefined;
  
  // Look backwards from hashtags to find the CTA
  // CTAs usually end with "21+" and contain "GreenHaus" or similar
  const beforeHashtags = caption.substring(0, hashtagIndex).trim();
  
  // Find the last sentence or phrase that contains "GreenHaus" or ends with "21+"
  const sentences = beforeHashtags.split(/[.!?]/).filter(s => s.trim().length > 0);
  
  // Look for sentence with "GreenHaus" or ending with "21+"
  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentence = sentences[i].trim();
    if (sentence.includes('GreenHaus') || sentence.includes('21+') || sentence.length > 20) {
      return sentence + (sentence.includes('21+') ? '' : ' 21+');
    }
  }
  
  // Fallback: last sentence before hashtags
  if (sentences.length > 0) {
    return sentences[sentences.length - 1].trim() + ' 21+';
  }
  
  return undefined;
}

// Save a generated caption to history
export async function saveCaptionToHistory(
  caption: string,
  imageUrls?: string[],
  contentName?: string
): Promise<void> {
  try {
    const hook = extractHook(caption);
    const cta = extractCTA(caption);
    
    const entry: Omit<CaptionHistoryEntry, 'id'> = {
      caption,
      hook,
      cta,
      createdAt: new Date(),
      imageUrls,
      contentName,
    };
    
    await adminDb.collection("caption_history").add(entry);
    console.log(`[Caption History] Saved caption to history (hook: ${hook?.substring(0, 30)}...)`);
  } catch (error) {
    console.error("[Caption History] Error saving caption:", error);
    // Don't throw - history is non-critical
  }
}

// Get recent captions to avoid repetition
export async function getRecentCaptions(limit: number = 30): Promise<CaptionHistoryEntry[]> {
  try {
    const snapshot = await adminDb
      .collection("caption_history")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    
    const entries: CaptionHistoryEntry[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      entries.push({
        id: doc.id,
        caption: data.caption,
        hook: data.hook,
        cta: data.cta,
        createdAt: data.createdAt?.toDate() || new Date(),
        imageUrls: data.imageUrls,
        contentName: data.contentName,
      });
    });
    
    console.log(`[Caption History] Retrieved ${entries.length} recent captions`);
    return entries;
  } catch (error) {
    console.error("[Caption History] Error retrieving recent captions:", error);
    return []; // Return empty array on error - don't block generation
  }
}

// Get unique hooks and CTAs from recent captions
export async function getRecentPhrasesToAvoid(): Promise<{
  hooks: string[];
  ctas: string[];
  recentCaptions: string[];
}> {
  const recent = await getRecentCaptions(30);
  
  const hooks = new Set<string>();
  const ctas = new Set<string>();
  const recentCaptions: string[] = [];
  
  recent.forEach((entry) => {
    if (entry.hook) {
      hooks.add(entry.hook.toLowerCase().trim());
    }
    if (entry.cta) {
      ctas.add(entry.cta.toLowerCase().trim());
    }
    // Store first 100 chars of each caption for context
    recentCaptions.push(entry.caption.substring(0, 100));
  });
  
  return {
    hooks: Array.from(hooks),
    ctas: Array.from(ctas),
    recentCaptions: recentCaptions.slice(0, 20), // Limit to 20 for prompt size
  };
}
