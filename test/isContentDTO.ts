import type { ContentDTO } from './test-types';
import { isString, isType } from 'guardz';
export const isContentDTO = isType<ContentDTO>({
  text: isString
});
