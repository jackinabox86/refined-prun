import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');

function read(path: string) {
  return readFileSync(path, 'utf8');
}

function headerTag(source: string) {
  const match = source.match(/<Header\b[^>]*\/>/);
  if (!match) {
    throw new Error('Header tag not found');
  }
  return match[0];
}

describe('default header validate', () => {
  it('accepts a non-empty name and leaves NOTE and TODO headers without validate', () => {
    const header = read(join(here, 'Header.vue'));
    const note = headerTag(read(join(src, 'features/XIT/NOTE/NoteEditor.vue')));
    const todo = headerTag(read(join(src, 'features/XIT/TODO/TaskList.vue')));
    const enter = header.slice(
      header.indexOf('function onEnterPress'),
      header.indexOf('function onBlur'),
    );

    expect(header).toContain('validate = () => true');
    expect(enter.indexOf('if (result !== true)')).toBeGreaterThan(-1);
    expect(enter.indexOf('model.value = inputValue.value')).toBeGreaterThan(
      enter.indexOf('if (result !== true)'),
    );
    expect(note).toBe('<Header v-model="note.name" editable :class="$style.header" />');
    expect(todo).toBe('<Header v-model="list.name" editable :class="$style.header" />');
    expect(note).not.toContain('validate');
    expect(todo).not.toContain('validate');
  });
});
