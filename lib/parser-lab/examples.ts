export type ParserExample = {
  id: string;
  name: string;
  topic: string;
  grammar: string;
  input: string;
  featured?: boolean;
};

export const EXAMPLES: ParserExample[] = [
  {
    id: "balanced-parentheses",
    name: "Balanced parentheses",
    topic: "Classic nullable grammar for balanced parentheses",
    featured: true,
    grammar: `S = "(" , S , ")" , S
  | ε ;`,
    input: "( ) ( )",
  },
  {
    id: "ll1-not-lr0-expression",
    name: "Expression",
    topic: "LL(1) expression grammar that is not LR(0)",
    featured: true,
    grammar: `Expr = Term , { "+" , Term } ;

Term = Factor , { "*" , Factor } ;

Factor = id | "(" , Expr , ")" ;`,
    input: "id + id * id",
  },
  {
    id: "slr-not-lr0-digits",
    name: "Number",
    topic: "SLR(1) digit sequence that is not LR(0)",
    featured: true,
    grammar: `Number = Digit , { Digit } ;

Digit = "0" | "1" | "2" | "3" ;`,
    input: "1 2 3",
  },
  {
    id: "lalr-not-slr-assignment",
    name: "Assignment reference",
    topic: "LALR(1) assignment grammar that is not SLR(1)",
    featured: true,
    grammar: `S = L , "=" , R
  | R ;

L = "*" , R
  | id ;

R = L ;`,
    input: "id = id",
  },
  {
    id: "lr1-not-lalr-lookahead",
    name: "LR(1), not LALR(1)",
    topic: "LALR merging loses distinct LR(1) lookaheads",
    featured: true,
    grammar: `S =
      "a" , A , "d"
    | "b" , B , "d"
    | "a" , B , "e"
    | "b" , A , "e" ;

A = "c" ;

B = "c" ;`,
    input: "a c d",
  },
  {
    id: "tiny-programming-language",
    name: "Tiny language",
    topic:
      "One larger example: assignments, print, conditionals, loops, and expressions",
    featured: true,
    grammar: `Program = StatementList ;

StatementList = Statement , { ";" , Statement } ;

Statement = Assignment | Print | IfStatement | WhileStatement ;

Assignment = id , "=" , Expr ;

Print = "print" , "(" , Expr , ")" ;

IfStatement = "if" , Expr , "then" , StatementList , "end" ;

WhileStatement = "while" , Expr , "do" , StatementList , "end" ;

Expr = Term , { "+" , Term } ;

Term = Factor , { "*" , Factor } ;

Factor = id | number | "(" , Expr , ")" ;`,
    input: "id = number ; print ( id )",
  },
  {
    id: "rd-only-optional-prefix",
    name: "Optional prefix",
    topic: "Recursive-descent-only counterexample for this analyzer",
    featured: true,
    grammar: `S = [ "a" ] , "a" ;`,
    input: "a a",
  },
  {
    id: "no-strategy-ambiguous-expression",
    name: "Ambiguous expression",
    topic: "Rejected by every strategy because precedence is unspecified",
    featured: true,
    grammar: `Expr = Expr , "+" , Expr
     | Expr , "*" , Expr
     | id ;`,
    input: "id + id * id",
  },
  {
    id: "variable-assignment",
    name: "Variable assignment",
    topic: "Single assignment statement",
    grammar: `Statement = id , "=" , Expr ;

Expr = id | number ;`,
    input: "id = number",
  },
  {
    id: "print-call",
    name: "Print call",
    topic: "Function-like statement",
    grammar: `Print = "print" , "(" , Expr , ")" ;

Expr = id | number ;`,
    input: "print ( id )",
  },
  {
    id: "if-without-else",
    name: "If block",
    topic: "Conditional block with explicit end",
    grammar: `Statement = "if" , Expr , "then" , Statement , "end"
  | "skip" ;

Expr = "true" | "false" ;`,
    input: "if true then skip end",
  },
  {
    id: "dangling-else",
    name: "Dangling else",
    topic: "Classic conditional ambiguity",
    grammar: `Statement = "if" , Expr , Statement
  | "if" , Expr , Statement , "else" , Statement
  | "other" ;

Expr = "true" ;`,
    input: "if true if true other else other",
  },
  {
    id: "right-recursive-statements",
    name: "Statement list",
    topic: "Right-recursive semicolon list",
    grammar: `StatementList = Statement , ";" , StatementList
        | Statement ;

Statement = "s" ;`,
    input: "s ; s ; s",
  },
  {
    id: "left-recursive-statements",
    name: "LR statement list",
    topic: "Left-recursive semicolon list",
    grammar: `StatementList = StatementList , ";" , Statement
        | Statement ;

Statement = "s" ;`,
    input: "s ; s ; s",
  },
  {
    id: "comma-separated-identifiers",
    name: "Identifier list",
    topic: "Comma-separated variable list",
    grammar: `VariableList = id , "," , VariableList
       | id ;`,
    input: "id , id , id",
  },
  {
    id: "declaration",
    name: "Declaration",
    topic: "Typed variable declaration",
    grammar: `Declaration = Type , VariableList ;

Type = "int" | "float" ;

VariableList = id , "," , VariableList
       | id ;`,
    input: "int id , id",
  },
  {
    id: "parenthesized-list",
    name: "Nested list",
    topic: "Parenthesized recursive list",
    grammar: `S = "(" , L , ")"
  | "a" ;

L = L , "," , S
  | S ;`,
    input: "( a , ( a ) )",
  },
  {
    id: "optional-sign-number",
    name: "Signed number",
    topic: "Optional sign and digit sequence",
    grammar: `Number = [ Sign ] , Digit , { Digit } ;

Sign = "+" | "-" ;

Digit = "0" | "1" | "2" | "3" ;`,
    input: "- 1 2",
  },
  {
    id: "decimal-number",
    name: "Decimal number",
    topic: "Digits before and after a dot",
    grammar: `Decimal = Digits , "." , Digits ;

Digits = Digit , { Digit } ;

Digit = "0" | "1" | "2" | "3" ;`,
    input: "1 2 . 3",
  },
  {
    id: "boolean-expression",
    name: "Boolean expression",
    topic: "Comparison with arithmetic operands",
    grammar: `Condition = Expr , RelOp , Expr ;

RelOp = "<" | ">" | "==" ;

Expr = id | number ;`,
    input: "id == number",
  },
  {
    id: "while-loop",
    name: "While loop",
    topic: "Loop statement with explicit end",
    grammar: `Statement = "while" , Condition , "do" , Statement , "end"
  | "skip" ;

Condition = id , "<" , number ;`,
    input: "while id < number do skip end",
  },
  {
    id: "array-index",
    name: "Array index",
    topic: "Postfix indexing",
    grammar: `Access = id , "[" , Expr , "]" ;

Expr = id | number ;`,
    input: "id [ number ]",
  },
  {
    id: "function-call",
    name: "Function call",
    topic: "Argument list",
    grammar: `Call = id , "(" , Arguments , ")" ;

Arguments = Expr , "," , Arguments
          | Expr ;

Expr = id | number ;`,
    input: "id ( id , number )",
  },
  {
    id: "binary-tree",
    name: "Binary tree",
    topic: "Recursive data literal",
    grammar: `Tree = "(" , number , Tree , Tree , ")"
     | "nil" ;`,
    input: "( number nil nil )",
  },
  {
    id: "regex-core",
    name: "Regex core",
    topic: "Ambiguous regular-expression operators",
    grammar: `Regex = Regex , "|" , Regex
      | Regex , Regex
      | Regex , "*"
      | "(" , Regex , ")"
      | letter ;`,
    input: "letter | letter *",
  },
];
