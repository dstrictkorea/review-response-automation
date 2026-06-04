-- 012_hard_delete_rpc_fix_circular_fk.sql
-- 011 hard_delete_reviews 의 순환 FK 버그 수정.
--
-- 문제: 영구 삭제 시 "update or delete on table review_import_rows violates foreign key
--       constraint reviews_source_import_row_id_fkey on table reviews" 발생.
-- 원인: 두 FK가 상호 참조(순환).
--   - review_import_rows.review_id -> reviews.id           (NO ACTION)
--   - reviews.source_import_row_id -> review_import_rows.id (NO ACTION)
--   011은 review_import_rows를 먼저 DELETE 시도 → 아직 살아있는 reviews가 그 행을
--   source_import_row_id로 참조 중이라 FK 위반.
-- 해결: review_import_rows를 삭제하지 않고 review_id 링크만 NULL 로 끊는다(둘 다 nullable).
--       이후 reviews 삭제(소유 outgoing FK는 행과 함께 제거). import 스테이징 감사도 보존.
create or replace function public.hard_delete_reviews(p_ids uuid[])
returns integer
language plpgsql
as $$
declare
  v_deletable uuid[];
  v_count     integer;
begin
  select array_agg(id)
    into v_deletable
    from public.reviews
   where id = any(p_ids)
     and deleted_at is not null;

  if v_deletable is null then
    return 0;
  end if;

  update public.review_import_rows set review_id = null where review_id = any(v_deletable);

  delete from public.reviews where id = any(v_deletable);
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.hard_delete_reviews(uuid[]) is
  '아카이브 영구 삭제: deleted_at IS NOT NULL 행만 물리 삭제. review_import_rows.review_id는 NULL로 끊어 순환 FK 회피 + import 감사 보존. 단일 트랜잭션, SECURITY INVOKER.';
