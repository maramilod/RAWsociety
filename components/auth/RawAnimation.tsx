"use client";

import { Hexagon } from "lucide-react";
import { motion } from "framer-motion";

export default function RawAnimation(){

return (
<div className="
relative
h-72
w-72
flex
items-center
justify-center
">


<motion.div
animate={{
scale:[1,1.05,1],
rotate:[0,8,-8,0],
}}
transition={{
duration:8,
repeat:Infinity,
ease:"easeInOut"
}}
>

<Hexagon
size={180}
strokeWidth={0.8}
className="
text-[var(--cta-bg)]
"
/>


</motion.div>


<motion.div
animate={{
scale:[1,1.1,1],
opacity:[0.15,0.35,0.15]
}}
transition={{
duration:6,
repeat:Infinity
}}
className="
absolute
h-44
w-44
rounded-full
bg-[var(--cta-bg)]
blur-3xl
"
/>


</div>
)

}