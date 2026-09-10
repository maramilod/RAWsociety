export default function InputField({
  label,
  type="text",
  placeholder,
  value,
  onChange
}:{
  label:string;
  type?:string;
  placeholder:string;
  value?:string;
  onChange?:(
    e:React.ChangeEvent<HTMLInputElement>
  )=>void;
}){

return(
<div className="mb-5">

<label className="mb-2 block font-medium">
{label}
</label>


<input
type={type}
placeholder={placeholder}
value={value}
onChange={onChange}
className="
h-14
w-full
rounded-xl
border
border-[var(--border-default)]
bg-[var(--profile-input-bg)]
px-4
outline-none
"
/>

</div>
)

}