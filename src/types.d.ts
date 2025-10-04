type JSX = {
  elementName: Function | string
  attributes: Record<string, any>
  children: (JSX | string)[]
}