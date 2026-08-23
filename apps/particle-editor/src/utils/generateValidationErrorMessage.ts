interface ValidationIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly errors?: readonly (readonly ValidationIssue[])[];
}

export function generateValidationErrorMessage(issues: readonly ValidationIssue[]) {
  return issues.flatMap((issue) => formatIssue(issue, [])).join('\n');
}

function formatIssue(issue: ValidationIssue, parentPath: readonly PropertyKey[]): string[] {
  const path = [...parentPath, ...issue.path];
  if (issue.errors?.length) {
    return issue.errors.flatMap((branch) => branch.flatMap((nestedIssue) => formatIssue(nestedIssue, path)));
  }
  return [`${formatPath(path)} - ${issue.message}`];
}

function formatPath(path: readonly PropertyKey[]) {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`;
    return `${result}[${JSON.stringify(String(segment))}]`;
  }, '$');
}
