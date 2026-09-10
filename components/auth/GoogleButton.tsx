"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";


export default function GoogleButton(){

return(

<button
onClick={()=>signIn("google")}
className="
flex
h-14
w-full
items-center
justify-center
gap-3
rounded-xl
border
border-[var(--border-default)]
hover:bg-gray-50
transition
"
>

<Image
src="/images/google.png"
alt="Google"
width={40}
height={40}
/>


Continue with Google


</button>

)

}