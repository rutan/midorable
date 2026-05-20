import { IValidation } from 'typia';

export function generateTypiaErrorMessage(errors: IValidation.IError[]) {
  return errors
    .map((error) => {
      return `${error.path} - expected: ${error.expected}, actual: ${JSON.stringify(error.value)}`;
    })
    .join('\n');
}
