import { normalizeProps, useMachine } from "@zag-js/solid"
import * as tree from "@zag-js/tree-view"
import {
  Accessor,
  createMemo,
  createUniqueId,
  Index,
  JSX,
  Show,
} from "solid-js"

interface Node {
  id: string
  name: string
  children?: Node[]
}

const collection = tree.collection<Node>({
  nodeToValue: (node) => node.id,
  nodeToString: (node) => node.name,
  rootNode: {
    id: "ROOT",
    name: "",
    children: [
      {
        id: "documents",
        name: "Documents",
        children: [
          { id: "resume.pdf", name: "Resume.pdf" },
          { id: "cover-letter.doc", name: "Cover Letter.doc" },
          {
            id: "projects",
            name: "Projects",
            children: [
              { id: "website", name: "Website" },
              { id: "mobile-app", name: "Mobile App" },
            ],
          },
        ],
      },
      {
        id: "downloads",
        name: "Downloads",
        children: [
          { id: "installer.exe", name: "installer.exe" },
          { id: "image.png", name: "image.png" },
        ],
      },
      {
        id: "music",
        name: "Music",
        children: [
          { id: "song1.mp3", name: "Favorite Song.mp3" },
          { id: "song2.mp3", name: "Another Song.mp3" },
        ],
      },
    ],
  },
})

interface TreeNodeProps {
  node: Node
  indexPath: number[]
  api: Accessor<tree.Api>
}

const TreeNode = (props: TreeNodeProps): JSX.Element => {
  const { node, indexPath, api } = props
  const nodeProps = { indexPath, node }
  const nodeState = createMemo(() => api().getNodeState(nodeProps))
  
  return (
    <Show
      when={nodeState().isBranch}
      fallback={
        <div 
          {...api().getItemProps(nodeProps)}
          class="flex items-center gap-2 py-1 px-3 hover:bg-gray-100 cursor-pointer rounded"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2"
            class="text-blue-500"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <span class="text-sm">{node.name}</span>
        </div>
      }
    >
      <div {...api().getBranchProps(nodeProps)}>
        <div 
          {...api().getBranchControlProps(nodeProps)}
          class="flex items-center gap-2 py-1 px-3 hover:bg-gray-100 cursor-pointer rounded"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2"
            class="text-yellow-500"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
          </svg>
          <span 
            {...api().getBranchTextProps(nodeProps)}
            class="text-sm font-medium"
          >
            {node.name}
          </span>
          <span 
            {...api().getBranchIndicatorProps(nodeProps)}
            class={`transform transition-transform ${nodeState().isExpanded ? 'rotate-90' : ''}`}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2"
              class="text-gray-400"
            >
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </span>
        </div>
        <div {...api().getBranchContentProps(nodeProps)}>
          <div 
            {...api().getBranchIndentGuideProps(nodeProps)}
            class="ml-4 border-l border-gray-200"
          />
          <div class="ml-4">
            <Index each={node.children}>
              {(childNode, index) => (
                <TreeNode
                  node={childNode()}
                  indexPath={[...indexPath, index]}
                  api={api}
                />
              )}
            </Index>
          </div>
        </div>
      </div>
    </Show>
  )
}

export function TreeView() {
  const service = useMachine(tree.machine, { id: createUniqueId(), collection })
  const api = createMemo(() => tree.connect(service, normalizeProps))

  return (
    <div 
      {...api().getRootProps()}
      class="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg"
    >
      <h3 
        {...api().getLabelProps()}
        class="text-lg font-bold mb-4 text-gray-800"
      >
        File Explorer
      </h3>
      <div 
        {...api().getTreeProps()}
        class="space-y-1"
      >
        <Index each={collection.rootNode.children}>
          {(node, index) => (
            <TreeNode node={node()} indexPath={[index]} api={api} />
          )}
        </Index>
      </div>
    </div>
  )
}