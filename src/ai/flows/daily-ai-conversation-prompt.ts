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

export async function dailyAiConversationPrompt(
  input: DailyAiConversationPromptInput
): Promise<DailyAiConversationPromptOutput> {
  return dailyAiConversationPromptFlow(input);
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
