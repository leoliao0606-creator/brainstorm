import { describe, expect, it } from 'vitest';
import {
  buildLensInstruction,
  buildMessages,
  buildOllamaChatPayload,
  buildOllamaQuestionPayload,
  buildQuestionMessages,
  normalizeIdeaGenerationPayload,
  parseIdeaPayload,
  parseQuestionPayload,
} from './ai.mjs';

describe('server ai helpers', () => {
  it('uses prompt id before title when selecting lens instructions', () => {
    expect(buildLensInstruction({
      language: 'en',
      prompt: { id: 'spot-risks', title: 'What Else Is Possible' },
    })).toContain('risks');
  });

  it('keeps title fallback for older clients', () => {
    expect(buildLensInstruction({
      language: 'zh',
      prompt: { title: '马上能做什么' },
    })).toContain('具体行动');
  });

  it('combines built-in lens guidance with custom user context', () => {
    const instruction = buildLensInstruction({
      language: 'en',
      prompt: { id: 'spot-risks', prompt: 'Focus on budget and timing.' },
    });

    expect(instruction).toContain('risks');
    expect(instruction).toContain('budget and timing');
  });

  it('includes id-derived lens guidance in generated messages', () => {
    const messages = buildMessages({
      language: 'en',
      topic: 'Weekend trip',
      prompt: { id: 'find-resources', title: 'Custom title', prompt: 'Custom prompt' },
      existingNotes: [{ text: 'Museum', tag: 'Idea', aiWeight: 2 }],
      aiSpecificity: 88,
      generationCount: 2,
    });

    expect(messages[1].content).toContain('Generate 2');
    expect(messages[1].content).toContain('resources');
    expect(messages[1].content).toContain('Specificity is 88/100');
    expect(messages[1].content).toContain('Custom title');
  });

  it('builds stream and non-stream Ollama chat payloads from the same prompt logic', () => {
    const payload = buildOllamaChatPayload({
      ollamaModel: 'test-model',
      language: 'en',
      topic: 'Workshop',
      prompt: { id: 'explore-options', title: 'Explore', prompt: 'Explore' },
      generationCount: 2,
      stream: true,
    });

    expect(payload.model).toBe('test-model');
    expect(payload.stream).toBe(true);
    expect(payload.format).toBe('json');
    expect(payload.messages[1].content).toContain('Generate 2');
  });

  it('builds reflective question prompts from the same board context', () => {
    const messages = buildQuestionMessages({
      language: 'en',
      topic: 'Workshop',
      prompt: { title: 'Reflect', prompt: 'Focus on stakeholder tradeoffs' },
      existingNotes: [{ text: 'Invite product leads', tag: 'People', aiWeight: 2 }],
      generationCount: 3,
    });

    expect(messages[0].content).toContain('questions');
    expect(messages[1].content).toContain('Generate 3');
    expect(messages[1].content).toContain('stakeholder tradeoffs');
    expect(messages[1].content).toContain('Invite product leads');
  });

  it('builds Ollama payloads for question generation', () => {
    const payload = buildOllamaQuestionPayload({
      ollamaModel: 'test-model',
      language: 'zh',
      topic: '周末旅行',
      prompt: { title: '追问', prompt: '关注预算' },
      generationCount: 4,
    });

    expect(payload.model).toBe('test-model');
    expect(payload.stream).toBe(false);
    expect(payload.format).toBe('json');
    expect(payload.messages[1].content).toContain('4 个');
  });

  it('parses model JSON, markdown fences, and object candidates', () => {
    const ideas = parseIdeaPayload('```json\n{"ideas":[{"text":"Idea 1: Book tickets"},{"idea":"Idea 2: Compare routes"},"Idea 3: Pack snacks"]}\n```');

    expect(ideas).toEqual(['Book tickets', 'Compare routes', 'Pack snacks']);
  });

  it('falls back to newline parsing and deduplicates usable ideas', () => {
    const ideas = parseIdeaPayload('1. First\n2. Second\nSecond\n3. Third');

    expect(ideas).toEqual(['First', 'Second', 'Third']);
  });

  it('splits numbered ideas when the model puts them into one JSON string', () => {
    const ideas = parseIdeaPayload('{"ideas":["1. Book a table\\n2. Compare menus\\n3. Prep snacks\\n4. Share costs\\n5. Avoid going out"]}');

    expect(ideas).toEqual(['Book a table', 'Compare menus', 'Prep snacks', 'Share costs', 'Avoid going out']);
  });

  it('allows smaller configured generation counts', () => {
    const ideas = parseIdeaPayload('{"ideas":["First","Second","Third"]}', { generationCount: 2 });

    expect(ideas).toEqual(['First', 'Second']);
  });

  it('parses question JSON and strips labels', () => {
    const questions = parseQuestionPayload('{"questions":["Question 1: What is missing?","问题2：谁需要参与？","What should happen next?"]}');

    expect(questions).toEqual(['What is missing?', '谁需要参与？', 'What should happen next?']);
  });

  it('normalizes generation payload and removes dismissed active-note duplicates', () => {
    const normalized = normalizeIdeaGenerationPayload({
      language: 'en',
      topic: 'Trip',
      prompt: { id: 'next-actions', title: 'Next', prompt: 'Go' },
      aiSpecificity: 101,
      existingNotes: [{ text: 'Book train', tag: 'Action', aiWeight: '3' }],
      dismissedNotes: ['book train', 'Rent bikes'],
    });

    expect(normalized.ok).toBe(true);
    expect(normalized.value.prompt.id).toBe('next-actions');
    expect(normalized.value.generationCount).toBe(5);
    expect(normalized.value.aiSpecificity).toBe(100);
    expect(normalized.value.existingNotes).toEqual([{ text: 'Book train', tag: 'Action', aiWeight: 3 }]);
    expect(normalized.value.dismissedNotes).toEqual(['Rent bikes']);
  });

  it('normalizes custom generation counts', () => {
    const normalized = normalizeIdeaGenerationPayload({
      language: 'en',
      topic: 'Trip',
      prompt: { id: 'next-actions', title: 'Next', prompt: 'Go' },
      generationCount: 99,
    });

    expect(normalized.ok).toBe(true);
    expect(normalized.value.generationCount).toBe(10);
  });

  it('allows an empty custom prompt when the board topic exists', () => {
    const normalized = normalizeIdeaGenerationPayload({
      language: 'en',
      topic: 'Trip',
      prompt: { id: 'custom', title: 'Custom input', prompt: '' },
    });

    expect(normalized.ok).toBe(true);
    expect(normalized.value.prompt.prompt).toBe('');
  });
});
