-- 011_hard_delete_rpc.sql
-- 아카이브(보관함) 영구 삭제(Hard Delete)용 안전 RPC.
--
-- 안전장치(설계상 비가역 대량 삭제 방지):
--   1) deleted_at IS NOT NULL(이미 소프트 삭제된) 행만 물리 삭제한다 → 라이브 리뷰는 절대 삭제 불가.
--   2) review_import_rows(reviews_id FK = NO ACTION)를 먼저 정리하여 FK 위반으로 인한 삭제 실패를 방지한다.
--      reply_drafts(CASCADE) · activity_logs(SET NULL)는 DB 제약이 자동 처리한다.
--   3) 함수 1개 = 트랜잭션 1개(원자성). 중간 실패 시 전체 롤백.
--   4) SECURITY INVOKER(기본) — 호출자 권한으로 실행되므로, 추후 RLS(009 STEP B) 적용 시
--      지점 범위 제한이 DB 레벨에서도 자동 적용된다(앱 레이어 가드와 이중 방어).
--
-- 호출: select public.hard_delete_reviews('{<uuid>,<uuid>}'::uuid[]);  → 실제 삭제된 건수(integer) 반환
create or replace function public.hard_delete_reviews(p_ids uuid[])
returns integer
language plpgsql
as $$
declare
  v_deletable uuid[];
  v_count     integer;
begin
  -- 소프트 삭제된 행만 영구 삭제 대상으로 확정 (라이브 행 보호)
  select array_agg(id)
    into v_deletable
    from public.reviews
   where id = any(p_ids)
     and deleted_at is not null;

  if v_deletable is null then
    return 0;
  end if;

  -- NO ACTION FK(import 스테이징 행) 선정리 → 물리 삭제가 FK로 실패하지 않도록 함
  delete from public.review_import_rows where review_id = any(v_deletable);

  -- 물리 삭제 (reply_drafts CASCADE / activity_logs SET NULL 자동 처리)
  delete from public.reviews where id = any(v_deletable);
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.hard_delete_reviews(uuid[]) is
  '아카이브 영구 삭제: deleted_at IS NOT NULL 행만 물리 삭제. review_import_rows 선정리로 FK 보호, 단일 트랜잭션, SECURITY INVOKER.';
