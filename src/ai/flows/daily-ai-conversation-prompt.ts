'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a daily AI conversation prompt.
 *
 * - dailyAiConversationPrompt - A function that generates a personalized daily conversation prompt.
 * - DailyAiConversationPromptInput - The input type for the dailyAiConversationPrompt function.
 * - DailyAiConversationPromptOutput - The return type for the dailyAiConversationPrompt function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DailyAiConversationPromptInputSchema = z.object({
  pastChatHistory: z
    .string()
    .optional()
    .describe(
      'An optional summary or excerpts of past conversations to inform the prompt generation. If not provided, a general prompt will be generated.'
    ),
});
export type DailyAiConversationPromptInput = z.infer<
  typeof DailyAiConversationPromptInputSchema
>;

const DailyAiConversationPromptOutputSchema = z.object({
  prompt: z.string().describe('The generated daily conversation prompt.'),
});
export type DailyAiConversationPromptOutput = z.infer<
  typeof DailyAiConversationPromptOutputSchema
>;

const FALLBACK_PROMPTS = [
  "If we could pause time for 24 hours just for the two of us, how would we spend it? 💫",
  "What is a small, quiet habit of mine that secretly makes you feel incredibly loved? 🌸",
  "If we could teleport to any place in the world for a dinner date tonight, where would we go? ✈️",
  "What is your absolute favorite memory of us from the past month? 📸",
  "What is a song that always reminds you of me whenever you hear it? 🎵",
  "What is one big dream you want us to work on and achieve together in the next two years? 🌟",
  "If you had to describe our connection using only three distinct words, what would they be? ❤️",
  "What is something new or adventurous you've been wanting us to try together? 🗺️",
  "Think back to the first few weeks we met. What was the exact moment you realized you had feelings? 💕",
  "What is a text message or note I sent you that you still remember clearly? 📱",
  "What is one question about my childhood or past that you've never asked me before? 🧸",
  "If our love story was made into a movie, what genre would it be and who would play us? 🎬",
  "What is a dream or goal of mine that you want to help me achieve the most? 🤝",
  "What is your favorite way to receive affection from me (words, touch, quality time, small gifts)? 💌",
  "What is a hidden talent or silly skill of mine that you find surprisingly attractive? 🔮",
  "If we could build our dream home anywhere, would it be by the ocean, in the mountains, or a cozy city loft? 🏡",
  "What is a place we've visited together that you would love to return to for an anniversary? 🗺️",
  "What is the best piece of advice about relationships that you think applies to us? 💡",
  "If we could swap roles for a single day, what is the first thing you would do as me? 🔄",
  "What is something you feel our relationship has taught you about yourself? 🌱",
  "What is one small thing I did recently that made you laugh or smile? 😄",
  "What are you most looking forward to experiencing together in the coming month? 🗓️",
  "What is a habit or hobby of mine that you would love to try learning together with me? 🎨",
  "What is the most thoughtful gesture you feel I've ever done for you? 🎁",
  "What does your perfect, slow weekend morning look like with me? ☕"
];

export async function dailyAiConversationPrompt(
  input: DailyAiConversationPromptInput
): Promise<DailyAiConversationPromptOutput> {
  try {
    const result = await dailyAiConversationPromptFlow(input);
    if (result && result.prompt) {
      return result;
    }
  } catch (err) {
    console.warn("[AI Spark] Genkit flow failed or API key missing. Using premium romantic fallback system.");
  }
  
  // Select a random premium fallback prompt
  const randomIndex = Math.floor(Math.random() * FALLBACK_PROMPTS.length);
  return {
    prompt: FALLBACK_PROMPTS[randomIndex]
  };
}

const dailyAiConversationPromptDef = ai.definePrompt({
  name: 'dailyAiConversationPrompt',
  input: { schema: DailyAiConversationPromptInputSchema },
  output: { schema: DailyAiConversationPromptOutputSchema },
  prompt: `You are an AI assistant designed to generate unique and engaging daily conversation prompts for a couple.
Your goal is to help them explore new topics and deepen their connection.

{{#if pastChatHistory}}
Here are some themes and excerpts from their past conversations to inspire you:
{{{pastChatHistory}}}

Based on these themes, generate a fresh and engaging conversation prompt that encourages them to discuss something new or explore an existing interest further. Make it personal and thought-provoking.
{{else}}
Generate a unique, fresh, and engaging conversation prompt for a couple to discuss today. Make it thought-provoking and designed to foster deeper connection.
{{/if}}

The prompt should be a single, clear question or statement.`,
});

const dailyAiConversationPromptFlow = ai.defineFlow(
  {
    name: 'dailyAiConversationPromptFlow',
    inputSchema: DailyAiConversationPromptInputSchema,
    outputSchema: DailyAiConversationPromptOutputSchema,
  },
  async (input) => {
    const { output } = await dailyAiConversationPromptDef(input);
    return output!;
  }
);
