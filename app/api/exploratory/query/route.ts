import {NextResponse} from "next/server";
import {runAiExploratoryEngine} from "@/src/engine/run-ai-exploratory-engine";
export async function POST(request:Request){try{return NextResponse.json(runAiExploratoryEngine(await request.json()));}catch(error){return NextResponse.json({error:"invalid_exploratory_query",detail:error instanceof Error?error.message:String(error)},{status:400});}}
