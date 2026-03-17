export function Button({children, ...props}) {
  return <button className="button" {...props}>{children}</button>
}

export function Input(props) {
  return <input className="input" {...props}/>
}

export function Panel({title, children}) {
  return (
    <div className="panel-block">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  )
}