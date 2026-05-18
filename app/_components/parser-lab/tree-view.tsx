import type { TreeNode } from "@/lib/parser-lab";

export function TreeView({ node }: { node: TreeNode }) {
  return (
    <ul className="ml-3 border-l border-zinc-800 pl-3 font-mono text-xs text-zinc-300">
      <li>
        <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-100">
          {node.label}
        </span>
        {node.children?.map((child, index) => (
          <TreeView key={`${child.label}-${index}`} node={child} />
        ))}
      </li>
    </ul>
  );
}
