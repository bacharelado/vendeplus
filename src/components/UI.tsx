import type {AnchorHTMLAttributes,ButtonHTMLAttributes,ReactNode} from 'react';
type Variant='primary'|'outline'|'danger';
const classes=(variant:Variant,full:boolean,className:string)=>['button',variant,full?'full':'',className].filter(Boolean).join(' ');
export function Button({variant='primary',full=false,className='',type='button',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Variant;full?:boolean}){
 return <button {...props} type={type} className={classes(variant,full,className)}/>;
}
export function ActionLink({variant='primary',full=false,className='',...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{variant?:Variant;full?:boolean}){
 return <a {...props} className={classes(variant,full,className)}/>;
}
export function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}){
 return <label className="form-field"><span>{label}</span>{children}{hint&&<span className="field-help">{hint}</span>}</label>;
}
