// A small Excel-like formula language: numbers, "strings", cell references, ranges (as function
// arguments), + - * /, parentheses, unary minus, and SUM, AVERAGE, MIN, MAX, COUNT. A reference copied off the
// sheet is written #REF!, as in Excel, and evaluates to that error.

import { parseAddress } from './address';

export type ErrorCode = '#REF!' | '#DIV/0!' | '#NAME?' | '#VALUE!' | '#CIRC!';
export interface FormulaError {
  error: ErrorCode;
}
export type CellValue = number | string | null | FormulaError;

type Lookup = (col: number, row: number) => CellValue;

export function isFormula(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.startsWith('=');
}

export function isError(value: CellValue): value is FormulaError {
  return typeof value === 'object' && value !== null;
}

const fail = (error: ErrorCode): FormulaError => ({ error });

// --- Tokens -------------------------------------------------------------------------------------

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'ref'; text: string }
  | { kind: 'badRef' }
  | { kind: 'name'; text: string }
  | { kind: 'op'; text: string };

const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|"((?:[^"]|"")*)"|(\$?[A-Za-z]+\$?\d+)|([A-Za-z_][A-Za-z0-9_.]*)|([-+*/():,])|(#[Rr][Ee][Ff]!))/y;

class SyntaxError_ extends Error {}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    if (/^\s*$/.test(text.slice(TOKEN.lastIndex))) break;
    const match = TOKEN.exec(text);
    if (!match) throw new SyntaxError_();
    const [, number, string, ref, name, op, badRef] = match;
    if (number !== undefined) tokens.push({ kind: 'number', value: Number(number) });
    else if (string !== undefined) tokens.push({ kind: 'string', value: string.replace(/""/g, '"') });
    else if (ref !== undefined) tokens.push({ kind: 'ref', text: ref });
    else if (name !== undefined) tokens.push({ kind: 'name', text: name });
    else if (badRef !== undefined) tokens.push({ kind: 'badRef' });
    else tokens.push({ kind: 'op', text: op });
  }
  return tokens;
}

// --- Syntax tree --------------------------------------------------------------------------------

type Node =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'ref'; col: number; row: number }
  | { type: 'badRef' }
  | { type: 'range'; from: { col: number; row: number }; to: { col: number; row: number } }
  | { type: 'negate'; arg: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] };

function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (text: string) => peek()?.kind === 'op' && (peek() as { text: string }).text === text;
  const expectOp = (text: string) => {
    if (!isOp(text)) throw new SyntaxError_();
    pos++;
  };

  function expression(): Node {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { text: string }).text;
      left = { type: 'binary', op, left, right: term() };
    }
    return left;
  }

  function term(): Node {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { text: string }).text;
      left = { type: 'binary', op, left, right: unary() };
    }
    return left;
  }

  function unary(): Node {
    if (isOp('-')) {
      pos++;
      return { type: 'negate', arg: unary() };
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return primary();
  }

  function reference(text: string): Node {
    const address = parseAddress(text);
    if (!address) return { type: 'badRef' };
    if (isOp(':')) {
      pos++;
      const next = tokens[pos++];
      if (next?.kind !== 'ref') throw new SyntaxError_();
      const to = parseAddress(next.text);
      if (!to) return { type: 'badRef' };
      return { type: 'range', from: address, to };
    }
    return { type: 'ref', ...address };
  }

  function primary(): Node {
    const token = tokens[pos++];
    if (!token) throw new SyntaxError_();
    if (token.kind === 'number') return { type: 'number', value: token.value };
    if (token.kind === 'string') return { type: 'string', value: token.value };
    if (token.kind === 'ref') return reference(token.text);
    if (token.kind === 'badRef') return { type: 'badRef' };
    if (token.kind === 'name') {
      expectOp('(');
      const args: Node[] = [];
      if (!isOp(')')) {
        args.push(expression());
        while (isOp(',')) {
          pos++;
          args.push(expression());
        }
      }
      expectOp(')');
      return { type: 'call', name: token.text.toUpperCase(), args };
    }
    if (token.text === '(') {
      const inner = expression();
      expectOp(')');
      return inner;
    }
    throw new SyntaxError_();
  }

  const node = expression();
  if (pos !== tokens.length) throw new SyntaxError_();
  return node;
}

// --- Evaluation ---------------------------------------------------------------------------------

function toNumber(value: CellValue): number | FormulaError {
  if (isError(value)) return value;
  if (value === null) return 0;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  return trimmed !== '' && Number.isFinite(Number(trimmed)) ? Number(trimmed) : fail('#VALUE!');
}

function scalar(node: Node, lookup: Lookup): CellValue {
  switch (node.type) {
    case 'number':
    case 'string':
      return node.value;
    case 'ref':
      return lookup(node.col, node.row);
    case 'badRef':
      return fail('#REF!');
    case 'range':
      return fail('#VALUE!');
    case 'negate': {
      const value = toNumber(scalar(node.arg, lookup));
      return isError(value) ? value : -value;
    }
    case 'binary': {
      const left = toNumber(scalar(node.left, lookup));
      if (isError(left)) return left;
      const right = toNumber(scalar(node.right, lookup));
      if (isError(right)) return right;
      if (node.op === '+') return left + right;
      if (node.op === '-') return left - right;
      if (node.op === '*') return left * right;
      return right === 0 ? fail('#DIV/0!') : left / right;
    }
    case 'call':
      return call(node.name, node.args, lookup);
  }
}

// Numbers from function arguments: ranges and references skip blanks and text; literals must be numbers.
function collectNumbers(args: Node[], lookup: Lookup): number[] | FormulaError {
  const numbers: number[] = [];
  for (const arg of args) {
    if (arg.type === 'range') {
      const [c1, c2] = [Math.min(arg.from.col, arg.to.col), Math.max(arg.from.col, arg.to.col)];
      const [r1, r2] = [Math.min(arg.from.row, arg.to.row), Math.max(arg.from.row, arg.to.row)];
      for (let row = r1; row <= r2; row++) {
        for (let col = c1; col <= c2; col++) {
          const value = lookup(col, row);
          if (isError(value)) return value;
          if (typeof value === 'number') numbers.push(value);
        }
      }
    } else if (arg.type === 'ref') {
      const value = lookup(arg.col, arg.row);
      if (isError(value)) return value;
      if (typeof value === 'number') numbers.push(value);
    } else {
      const value = toNumber(scalar(arg, lookup));
      if (isError(value)) return value;
      numbers.push(value);
    }
  }
  return numbers;
}

function call(name: string, args: Node[], lookup: Lookup): CellValue {
  const functions: Record<string, (numbers: number[]) => CellValue> = {
    SUM: (n) => n.reduce((a, b) => a + b, 0),
    AVERAGE: (n) => (n.length === 0 ? fail('#DIV/0!') : n.reduce((a, b) => a + b, 0) / n.length),
    // reduce, not Math.min(...n): spreading a very large range overflows the call stack.
    MIN: (n) => (n.length === 0 ? 0 : n.reduce((a, b) => Math.min(a, b))),
    MAX: (n) => (n.length === 0 ? 0 : n.reduce((a, b) => Math.max(a, b))),
    COUNT: (n) => n.length,
  };
  const fn = functions[name];
  if (!fn) return fail('#NAME?');
  const numbers = collectNumbers(args, lookup);
  return Array.isArray(numbers) ? fn(numbers) : numbers;
}

function hasEmptyCall(node: Node): boolean {
  switch (node.type) {
    case 'call':
      return node.args.length === 0 || node.args.some(hasEmptyCall);
    case 'negate':
      return hasEmptyCall(node.arg);
    case 'binary':
      return hasEmptyCall(node.left) || hasEmptyCall(node.right);
    default:
      return false;
  }
}

// Whether desktop Excel can read this formula: it parses, and no function is called with no arguments.
export function isValidFormula(formula: string): boolean {
  try {
    return !hasEmptyCall(parse(tokenize(formula.replace(/^=/, ''))));
  } catch (error) {
    if (error instanceof SyntaxError_) return false;
    throw error;
  }
}

export function evaluateFormula(formula: string, lookup: Lookup): CellValue {
  let tree: Node;
  try {
    tree = parse(tokenize(formula.replace(/^=/, '')));
  } catch (error) {
    if (error instanceof SyntaxError_) return fail('#NAME?');
    throw error;
  }
  const value = scalar(tree, lookup);
  // A formula that points at a blank cell shows 0, as in Excel.
  return value === null ? 0 : value;
}
