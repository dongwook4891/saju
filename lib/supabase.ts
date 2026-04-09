import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 서버 전용 클라이언트 (service role key 사용 - 브라우저에 절대 노출 금지)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
