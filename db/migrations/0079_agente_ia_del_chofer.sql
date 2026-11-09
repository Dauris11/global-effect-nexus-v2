-- 0079 · El agente operativo atiende al chofer, no a un rol que ya no existe.
--
-- La 0057 sembró `agente_colaborador` con ARRAY['colaborador'] y la 0065 borró
-- ese rol. El código ya enruta al chofer a este agente (`AGENTE_POR_ROL`), pero
-- la pantalla de configuración de IA traducía `roles.colaborador`, que no
-- existe, y la página fallaba.

UPDATE public.ai_agente
   SET roles = ARRAY['chofer']
 WHERE clave = 'agente_colaborador'
   AND roles = ARRAY['colaborador'];
