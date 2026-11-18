(function (root) {
  const BASE_OVR = { N: 50, R: 56, S: 62, U: 68, L: 74 };
  const MAX_PLUS = { N: 20, R: 20, S: 10, U: 10, L: 5 };
  const GAIN = { N: 1, R: 1, S: 2, U: 2, L: 4 };
  const NEXT_GRADE = { N: 'R', R: 'S', S: 'U', U: 'L', L: 'L' };
  const GRADE_NAME = { N: '노멀', R: '레어', S: '스페셜', U: '유니크', L: '레전드' };
  const RATES = [
    { grade: 'N', name: '노멀', pct: '85.00', weight: 8500 },
    { grade: 'R', name: '레어', pct: '12.00', weight: 1200 },
    { grade: 'S', name: '스페셜', pct: '2.10', weight: 210 },
    { grade: 'U', name: '유니크', pct: '0.74', weight: 74 },
    { grade: 'L', name: '레전드', pct: '0.16', weight: 16 }
  ];
  const TRADE_UP = { N: 3000, R: 1400, S: 1200, U: 600 };
  const POS_KO = {
    C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수',
    LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명타자', P: '투수'
  };
  const BAT_LABELS = ['순발력', '주력', '발사각', '정확', '파워', '수비'];
  const PIT_LABELS = ['구속', '제구', '구위', '변화', '체력', '멘탈'];
  const MBTIS = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];
  const MBTI_LINE = {
    ISTJ: '순서를 어기지 않고, 같은 루틴으로 글러브를 낀다.',
    ISFJ: '팀이 흔들리면 자기 자랑 대신 옆 사람을 먼저 세운다.',
    INFJ: '경기가 끝나기 전에 이미 다음 이닝의 그림을 그린다.',
    INTJ: '말은 적고, 상대의 버릇을 공책에 남긴다.',
    ISTP: '설명보다 손끝으로 타이밍을 고친다.',
    ISFP: '떠들썩한 세리머니 대신 공의 소리를 듣는다.',
    INFP: '지고 있는 이닝에서도 자기만의 이유를 지키며 배트를 든다.',
    INTP: '감으로 치기보다, 실패한 타구의 이유를 먼저 묻는다.',
    ESTP: '카운트가 몰릴수록 오히려 발걸음이 가벼워진다.',
    ESFP: '덕아웃의 분위기를 먼저 살리고, 타석에서도 그 온기를 가져간다.',
    ENFP: '루즈한 흐름을 견디지 못하고, 먼저 경기의 온도를 올린다.',
    ENTP: '정석 코스 옆의 빈틈을 찾는 일을 놀이처럼 즐긴다.',
    ESTJ: '사인이 흔들리면 자기가 기준이 되어 다시 맞춘다.',
    ESFJ: '동료의 실수 다음 공을 자기 몫처럼 받아 낸다.',
    ENFJ: '점수가 필요하면 조용히 타순의 등을 밀어 준다.',
    ENTJ: '이길 이닝을 정해 두고, 그 이닝까지 힘을 아낀다.'
  };
  const BAT_BIAS = {
    C: [2, -8, 0, 2, 2, 8],
    '1B': [-2, -6, 6, 0, 10, 2],
    '2B': [4, 4, -4, 6, -4, 6],
    '3B': [0, -2, 4, 2, 6, 4],
    SS: [4, 6, -4, 2, -4, 8],
    LF: [0, 0, 6, -2, 8, -2],
    CF: [6, 8, -2, 2, -2, 4],
    RF: [2, 2, 4, 0, 6, 0],
    DH: [-4, -6, 8, 0, 12, -6]
  };
  const PIT_BIAS = [
    [10, -2, 8, 2, -6, 0],
    [-2, 10, 2, 4, 2, 4],
    [4, 2, 4, 10, -4, 0],
    [2, 2, 2, 0, 8, 6],
    [6, 4, 6, 2, -2, 4]
  ];
  const FAMILY = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '전', '고', '문', '양', '손', '배', '백', '허', '유', '남', '심', '노', '하', '곽', '성', '차', '주', '우', '구', '민'];
  const GIVEN = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '준서', '건우', '현우', '우진', '선우', '태윤', '승현', '지훈', '성민', '재원', '동현', '준혁', '하늘', '도하', '은우', '시후', '유준', '연우', '지안', '하율', '이안', '은호', '시온', '가온', '다온', '하람', '건호', '태오', '시윤', '도경', '민재', '서진', '유찬', '하진', '준영', '시현', '도훈', '은성', '지율', '태민', '서우', '하민', '도원', '시완', '건희', '예성', '주호', '민성', '서하', '도연', '은재'];
  const ORIGINS = [
    ['목포', '부두 창고', '새벽 하역'],
    ['속초', '방파제', '파도 치는 타석'],
    ['군산', '폐역 플랫폼', '막차 대기'],
    ['통영', '조선소 골목', '철판 소리'],
    ['여수', '등대 아래', '밤바다 조명'],
    ['강릉', '송림 운동장', '솔바람 수비'],
    ['안동', '하회 길', '골목 송구'],
    ['경주', '옛 운동장', '달빛 연습'],
    ['전주', '한옥 마을 뒤', '골목 전봇대'],
    ['춘천', '호숫가', '안개 속 캐치'],
    ['포항', '제철소 사택', '야간 교대'],
    ['제주', '돌담 학교', '바람의 중견'],
    ['서귀포', '귤창고', '노란 공'],
    ['순천', '갈대밭 끝', '습지 주루'],
    ['밀양', '얼음골 길', '새벽 러닝'],
    ['나주', '배 과수원', '나뭇가지 플라이'],
    ['영주', '소백 자락', '산골 분교'],
    ['태백', '탄광 사택', '막차 글러브'],
    ['삼척', '해안 도로', '해풍 제구'],
    ['보령', '머드 갯벌', '간조의 블로킹'],
    ['담양', '대나무밭', '댓잎 소리'],
    ['하동', '차밭 언덕', '초록 타구'],
    ['울릉', '나리분지', '섬의 에이스'],
    ['남원', '광한루 뒤', '소리꾼의 타순']
  ];
  const KEEPS = ['금이 간 배트', '형의 헌 글러브', '비에 젖은 연습 공책', '실밥 풀린 공', '퇴색한 등번호', '엄마가 꿰맨 모자', '첫 홈런 공', '녹슨 스파이크', '손편지 한 장', '학교 분필 한 조각', '부두에서 주운 실', '구멍 난 양말', '형 사진이 든 지갑', '기름 얼룩 수건'];
  const BEATS = [
    '{keep}. 그는 그걸 경기마다 가져왔다.',
    '{keep}. 패한 날에는 그것부터 닦았다.',
    '팀이 흔들려도 {pos} 자리는 한 걸음도 비우지 않았다.',
    '관중이 없는 아침, {pos} 앞에서 같은 코스를 백 번 반복했다.',
    '조명이 꺼진 뒤에도 {pos} 근처에 남아 공 자국을 확인했다.',
    '어린 동료에게 자리는 내주어도, 경기의 책임은 내려놓지 않았다.',
    '멀리서 온 스카우트가 기억한 것은 성적이 아니라 {pos}에서의 그 버릇이었다.',
    '비 오는 날일수록 {pos} 앞으로 먼저 나갔다.'
  ];
  const CLOSES = [
    '그 하루들이 겹쳐 이 선수의 사연이 되었다.',
    '이름값보다 그 반복이 먼저 구단에 들어왔다.',
    '사람들은 결과보다 그 장면을 먼저 말한다.',
    '반짝임은 작았지만, 경기는 그 작은 쪽에서 기울었다.',
    '같은 등급 안에서도 그의 하루는 다른 얼굴이었다.',
    '기록지 여백에 남은 것은 상장이 아니라 그 버릇이다.'
  ];

  const HAND = [
    { grade: 'L', name: '카이토 쇼', pos: 'P', role: 'SP', mbti: 'ENTJ', title: '이도류의 전설',
      base: [79, 70, 78, 79, 68, 70],
      story: '오른손의 직구와 왼 궤적의 슬라이더. 태평양 건너 작은 항구에서 그는 두 개의 칼을 동시에 갈았다. 한 이닝도 같은 길로 끝나지 않았고, 승부를 두 번 베고도 숨이 차지 않았다. 사람들이 그를 이도류라 부른 건 구종이 많아서가 아니라, 마운드 위의 침묵이 칼날처럼 짧았기 때문이다. 1선발의 공은 항상 경기보다 먼저 도착했다.' },
    { grade: 'L', name: '이순신', pos: 'P', role: 'CL', mbti: 'ISTJ', title: '불패의 명장',
      base: [78, 74, 79, 76, 62, 75],
      story: '그는 점수를 먼저 말하지 않았다. 바람과 카운트, 아직 닫히지 않은 9회만 읽었다. 적은 리드로도 마운드를 비우지 않던 마무리. 패배란 그에게 끝난 경기가 아니라, 아직 명령하지 않은 마지막 타자였다. 불펜 문이 열릴 때마다 팀은 다시 진형을 맞췄다.' },
    { grade: 'L', name: '백광호', pos: '1B', role: '1B', mbti: 'ENFJ', title: '달을 벤 1루수',
      base: [68, 64, 78, 76, 79, 79],
      story: '탄광촌의 마지막 가로등 아래에서 그의 스윙이 시작됐다. 해 질 녘 담장 너머로 달이 뜨면, 그는 하늘이 아니라 그 빛에 배트를 맞췄다. 1루를 지키면서도 담장을 넘기는 만능 거포. 사람들은 그 홈런을 달빛이라 불렀고, 그는 달을 벤 것이 아니라 밤을 견딘 것이라고 웃었다.' },
    { grade: 'L', name: '진하늘', pos: 'LF', role: 'LF', mbti: 'INFJ', title: '창공을 가르는 거포',
      base: [74, 72, 76, 74, 79, 69],
      story: '외야는 그의 활주로였다. 타구가 사라지는 하늘에서 그는 한 걸음 먼저 서 있었고, 배트를 쥐면 그 하늘을 거꾸로 갈랐다. 폭풍이 지붕을 걷어 간 밤, 소년은 별을 세며 공이 떨어질 거리까지 외웠다. 글러브에도 담장에도 닿는 선수. 좌익의 만능 거포는 그렇게 경기를 다시 살렸다.' },
    { grade: 'U', name: '서벽우', pos: '3B', role: '3B', mbti: 'INFP', title: '시골 분교의 벽치기 소년',
      base: [66, 64, 70, 74, 72, 62],
      story: '분교의 흙벽은 담장이 되기 전에 그의 백네트였다. 친구는 네 명, 글러브는 하나. 벽이 되받아 준 공으로만 타격을 익힌 소년은, 도시 조명이 없는 운동장에서도 라인 끝을 갈랐다. 스카우트가 찾아온 날 그는 벽을 쓰다듬고 떠났다. 그 벽에는 아직도 공 자국이 별처럼 남아 있다.' },
    { grade: 'U', name: '박만철', pos: 'DH', role: 'DH', mbti: 'ESTP', title: '늦깎이 사회인 야구 홈런왕',
      base: [60, 56, 79, 68, 79, 66],
      story: '서른일곱, 퇴근길의 흙먼지, 회사 야구부의 금 간 배트. 남들이 은퇴를 권할 나이에 그는 담장을 넘기기 시작했다. 낮에는 전표를 정리하고 밤에는 발사각을 정리했다. 사회인 리그의 홈런왕은 왕관을 쓰지 않았다. 다음 날도 정시에 출근했고, 주말마다 하늘로 공을 보냈다.' },
    { grade: 'U', name: '고태산', pos: 'P', role: 'SP', mbti: 'ISTJ', title: '폭우를 이긴 완투',
      base: [70, 74, 66, 60, 78, 60],
      story: '우천 취소가 선언되기 직전, 그는 마운드에 남았다. 젖은 공, 보이지 않는 포수 사인, 미끄러운 흙. 아홉 이닝 뒤 유니폼은 비의 무게였고 인터뷰는 침묵이었다. 사람들은 승리투수라 불렀지만 그는 고개만 저었다. 이긴 것은 자신이 아니라, 비를 견딘 팀이라고.' },
    { grade: 'U', name: '유여름', pos: 'C', role: 'C', mbti: 'ISFJ', title: '왼쪽 눈의 포수',
      base: [64, 58, 66, 72, 69, 79],
      story: '오른쪽 눈은 어릴 적 연습 파울에 빛을 잃었다. 그래도 그는 마스크를 벗지 않았다. 남은 눈으로 공의 회전을 읽고, 귀로 타자의 호흡을 읽었다. 투수들은 그의 사인에서 두려움을 덜었다. 한쪽 눈으로 본 스트라이크존은 좁았지만, 그 존을 믿는 팀은 넓어졌다.' },
    { grade: 'U', name: '남궁현', pos: 'RF', role: 'RF', mbti: 'ENTP', title: '야간 열차의 4번 타자',
      base: [66, 68, 76, 64, 79, 55],
      story: '낮 경기는 그의 시간이 아니었다. 밤기차 식당칸에서 일하고, 종착역의 빈 구장에서 배팅 연습을 했다. 네 번째 타순에 설 때마다 플랫폼 방송 같은 목소리가 들렸다. 홈런은 열차 시각보다 정확했다. 늦는 법은 타구뿐이었다. 언제나 담장보다 먼저 도착했다.' },
    { grade: 'U', name: '차도윤', pos: 'CF', role: 'CF', mbti: 'INTJ', title: '침묵의 중견수',
      base: [76, 78, 58, 66, 56, 74],
      story: '덕아웃에서 그의 목소리는 들리지 않았다. 대신 타구가 갈라지는 각도가 그의 문장이었다. 글러브는 낮게, 송구는 짧게, 세리머니는 없었다. 팀이 흔들릴수록 중견 자리는 더 조용해졌고, 그 조용함이 외야를 붙들었다. 팬들은 그를 벽이라 불렀다. 공은 벽에서 돌아왔다.' },
    { grade: 'U', name: '백시온', pos: 'P', role: 'SP', mbti: 'INFP', title: '등번호 없는 에이스',
      base: [76, 72, 70, 64, 62, 64],
      story: '유니폼 등에는 숫자가 없었다. 구단이 잊었는지 본인이 지웠는지 아무도 묻지 않았다. 초구는 언제나 스트라이크였고, 마지막 공은 언제나 자신의 것이 아니었다. 승리 인터뷰를 거절한 자리에 그는 어린 투수의 어깨를 두드렸다. 에이스의 이름은 전광판보다 벤치에서 먼저 불렸다.' },
    { grade: 'U', name: '정다운', pos: 'P', role: 'RP', mbti: 'ESFJ', title: '마지막 이닝의 어머니',
      base: [66, 72, 68, 64, 66, 72],
      story: '낮에는 급식실, 저녁에는 불펜. 아이의 리틀 경기가 끝난 뒤 그녀는 성인 리그 글러브를 꼈다. 승리조에도, 추격조에도, 마무리 언덕에도 같은 자세로 올라왔다. 9회, 한 점 뒤진 공은 높지 않았지만 정확했다. 홈런보다 먼저 도착한 것은 엄마의 손짓이었고, 팀은 그 손짓을 역전이라고 기억한다.' },
    { grade: 'S', name: '오하람', pos: 'CF', mbti: 'ENFP', title: '분필가루 중견수',
      base: [70, 74, 58, 64, 52, 54],
      story: '운동장 흰 선 대신 분필로 베이스를 그리던 아이였다. 수업 종이 울리면 가방을 내려놓고 하늘로 달렸고, 선생님은 혼내다 말고 글러브를 내밀었다. 그의 중견수 자리는 아직도 분필 먼지처럼 환하다.' },
    { grade: 'S', name: '문지우', pos: 'P', role: 'SP', mbti: 'ENTJ', title: '폐교의 마지막 좌완',
      base: [64, 72, 66, 60, 54, 56],
      story: '문이 잠긴 폐교에서 그는 흙만 남은 마운드를 혼자 다졌다. 포수는 담벼락이었고, 스트라이크는 금이 간 벽돌 사이였다. 스카우트 편지가 도착한 날, 그는 학교 열쇠를 우체통에 넣고 떠났다.' },
    { grade: 'S', name: '한겨울', pos: '2B', mbti: 'ISFP', title: '눈사람 글러브',
      base: [66, 68, 54, 70, 50, 64],
      story: '첫 글러브는 눈사람이 끼고 있던 형의 것이었다. 녹기 전에 2루 송구를 연습하던 아이는, 봄이 와도 그 차갑고 정확한 손을 잊지 않았다. 병살의 첫 발이 유난히 빠른 이유다.' },
    { grade: 'S', name: '도진우', pos: '1B', mbti: 'ESTJ', title: '조선소의 장타',
      base: [56, 52, 68, 60, 76, 60],
      story: '망치 소리가 그의 타구음이었다. 낮에는 철판, 밤에는 배트. 공이 날아가는 거리를 용접 불꽃의 길이로 가늠했다. 담장을 넘길 때마다 도크의 사이렌이 마음속에서 다시 울렸다.' },
    { grade: 'S', name: '설아린', pos: 'LF', mbti: 'ENFJ', title: '등대 아래의 타석',
      base: [62, 64, 66, 60, 68, 52],
      story: '등대 불이 켜져야 연습이 시작됐다. 파도 소리에 맞춰 타이밍을 재던 좌익수는, 바람이 거셀수록 타구를 더 곧게 보냈다. 바다를 등지고 친 공은 언제나 마을 쪽으로 날아갔다.' },
    { grade: 'S', name: '구본혁', pos: '3B', mbti: 'ESTP', title: '시장 골목의 3루수',
      base: [64, 60, 62, 58, 66, 62],
      story: '박스 글러브, 고무 공, 좌판 사이의 3루. 그는 굴러오는 사과와 땅볼을 같은 손으로 잡았다. 정식 구장에 선 첫날에도 글러브에는 고추 가루가 조금 남아 있었고, 송구는 거스름돈처럼 정확했다.' },
    { grade: 'S', name: '나희수', pos: 'RF', mbti: 'INFJ', title: '폐관 시간의 우익수',
      base: [60, 62, 64, 66, 64, 56],
      story: '도서관 폐관 방송이 그의 연습 시작 종이었다. 창가에서 경기 기록을 베끼던 학생은 어느 날 책을 덮고 우익수 담장 앞으로 갔다. 타구 판단은 각주처럼 조용하고 정확했다.' },
    { grade: 'S', name: '마준', pos: 'SS', mbti: 'ENTP', title: '골목 방송의 유격수',
      base: [68, 70, 52, 62, 48, 72],
      story: '스피커로 중계를 틀어 주던 문방구 아이가 글러브를 꼈다. 모든 땅볼에 해설을 붙였고, 해설이 끝날 때쯤 송구도 1루에 도착했다. 침묵이 필요해진 뒤에도 발은 여전히 수다스러웠다.' },
    { grade: 'S', name: '표이안', pos: 'C', mbti: 'ISTJ', title: '어선의 포수',
      base: [58, 50, 60, 64, 62, 78],
      story: '새벽에 그물을 걷고 오후에 마스크를 썼다. 배의 기울기를 읽듯 투구의 흔들림을 읽었다. 블로킹은 갑판에 쏟아진 고기를 막던 몸과 같았고, 팀은 그의 무릎 뒤에서 파도를 피했다.' },
    { grade: 'S', name: '라온', pos: 'DH', mbti: 'ESFP', title: '축제의 마지막 타자',
      base: [54, 50, 74, 58, 78, 58],
      story: '불꽃놀이가 끝나야 그의 타석이 왔다. 사람들이 돌아간 빈 운동장에서 그는 네 번째 타순을 자청했다. 홈런이 터져도 아무도 없었지만, 다음 해 축제의 첫 폭죽은 언제나 그 타구를 흉내 냈다.' },
    { grade: 'S', name: '신태오', pos: 'P', role: 'SP', mbti: 'ISTP', title: '시계방 아들의 제구',
      base: [58, 76, 60, 58, 60, 60],
      story: '아버지 시계처럼 그의 초구는 늦거나 빠르지 않았다. 기어를 맞추듯 손목 각도를 고쳤고, 포수 미트는 정확한 시각에 울렸다. 사람들은 구속보다 그 시계침을 보러 왔다.' },
    { grade: 'S', name: '배수아', pos: 'CF', mbti: 'INTP', title: '바람 지도',
      base: [68, 72, 56, 66, 50, 60],
      story: '그는 바람의 방향을 공책에 날짜별로 적었다. 중견수 자리는 그 지도의 중심이었다. 타구가 뜨면 그는 이미 한 칸 옆 페이지에 서 있었고, 글러브에 들어온 공은 예언이 아니라 기록이었다.' },
    { grade: 'S', name: '최무결', pos: '1B', mbti: 'ENTJ', title: '판결의 1루수',
      base: [58, 54, 64, 68, 70, 58],
      story: '아버지 법정 방청석에서 그는 스트라이크와 볼을 먼저 배웠다. 애매한 송구는 그에게 증거가 부족한 공이었다. 1루 베이스를 밟는 발은 언제나 판결문처럼 단정했다.' },
    { grade: 'S', name: '양태양', pos: 'P', role: 'RP', mbti: 'ENFP', title: '해 뜨기 전의 불펜',
      base: [74, 60, 68, 56, 56, 58],
      story: '종이 치기 전, 구장 불이 켜지기 전, 그는 이미 열 개의 공을 던졌다. 해가 마운드에 닿을 때쯤 몸도 데워졌다. 이름 때문에 사람들이 웃었지만, 타자들은 그 빛 속에서 공을 놓쳤다.' },
    { grade: 'S', name: '강노을', pos: 'RF', mbti: 'ISFP', title: '노을을 쫓는 우익수',
      base: [64, 66, 70, 58, 62, 52],
      story: '연습은 하늘이 붉어질 때만 했다. 타구가 노을 속으로 사라지면 그는 색이 바뀌는 쪽을 먼저 달렸다. 팬들은 우익 플라이가 떨어지기 전에 하늘이 한 톤 어두워진다고 말했다.' },
    { grade: 'S', name: '임바다', pos: 'C', mbti: 'INFP', title: '간조의 포수',
      base: [60, 52, 62, 66, 58, 74],
      story: '바닷물이 빠지면 드러나는 갯벌처럼, 그는 경기가 조용해질 때 진가를 냈다. 폭투는 갯물에 박히듯 그의 몸에 멈췄다. 투수가 고개를 숙이면 그는 마스크 너머로 고개를 저었다. 아직 밀물이 남아 있다고.' }
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function fitStats(targetOvr, bias) {
    const sum = targetOvr * 6;
    const mid = targetOvr;
    const lo = Math.max(28, mid - 16);
    const hi = Math.min(79, mid + 14);
    const stats = bias.map(function (b) { return Math.max(lo, Math.min(hi, mid + b)); });
    let diff = sum - stats.reduce(function (a, b) { return a + b; }, 0);
    let guard = 0;
    while (diff !== 0 && guard++ < 80) {
      let pick = -1;
      if (diff > 0) {
        for (let i = 0; i < 6; i++) if (stats[i] < hi && (pick < 0 || bias[i] > bias[pick])) pick = i;
        if (pick < 0) break;
        stats[pick]++; diff--;
      } else {
        for (let i = 0; i < 6; i++) if (stats[i] > lo && (pick < 0 || bias[i] < bias[pick])) pick = i;
        if (pick < 0) break;
        stats[pick]--; diff++;
      }
    }
    if (stats.reduce(function (a, b) { return a + b; }, 0) !== sum) {
      throw new Error('기본 능력치 합이 오버롤과 맞지 않습니다.');
    }
    return stats;
  }

  function positionsFor(grade) {
    const bats = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    const list = [];
    const batCount = grade === 'N' ? 26 : 16;
    const spCount = grade === 'N' ? 20 : 8;
    const rpCount = grade === 'N' ? 18 : 8;
    for (let i = 0; i < batCount; i++) {
      const pos = bats[i % bats.length];
      list.push({ pos: pos, role: pos });
    }
    for (let i = 0; i < spCount; i++) list.push({ pos: 'P', role: 'SP' });
    for (let i = 0; i < rpCount; i++) list.push({ pos: 'P', role: 'RP' });
    return list;
  }

  const usedNames = {};
  HAND.forEach(function (p) { usedNames[p.name] = true; });

  function uniqueName(rng) {
    for (let i = 0; i < 400; i++) {
      const name = FAMILY[Math.floor(rng() * FAMILY.length)] + GIVEN[Math.floor(rng() * GIVEN.length)];
      if (!usedNames[name]) {
        usedNames[name] = true;
        return name;
      }
    }
    const fallback = '무명' + Object.keys(usedNames).length;
    usedNames[fallback] = true;
    return fallback;
  }

  function buildGenerated(startNo, grade) {
    const list = [];
    positionsFor(grade).forEach(function (slot, index) {
      const pos = slot.pos;
      const no = startNo + index;
      const rng = mulberry32((0xC0FFEE ^ (no * 9973)) >>> 0);
      const name = uniqueName(rng);
      const mbti = MBTIS[Math.floor(rng() * MBTIS.length)];
      const origin = ORIGINS[Math.floor(rng() * ORIGINS.length)];
      const keep = KEEPS[Math.floor(rng() * KEEPS.length)];
      const beat = BEATS[Math.floor(rng() * BEATS.length)];
      const close = CLOSES[Math.floor(rng() * CLOSES.length)];
      const bias = pos === 'P' ? PIT_BIAS[Math.floor(rng() * PIT_BIAS.length)] : BAT_BIAS[pos];
      const posKo = POS_KO[pos];
      const openRoll = rng();
      const code = name.charCodeAt(name.length - 1);
      const batchim = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
      const opening = openRoll < 0.5
        ? name + (batchim ? '은 ' : '는 ') + origin[0] + ' ' + origin[1] + '에서 ' + posKo + '로 자랐다. '
        : origin[0] + ' ' + origin[1] + ', ' + posKo + ' ' + name + '. ';
      const story = opening + MBTI_LINE[mbti] + ' ' +
        beat.split('{pos}').join(posKo).split('{keep}').join(keep) + ' ' + close;
      list.push({
        no: no,
        grade: grade,
        name: name,
        pos: pos,
        role: slot.role,
        mbti: mbti,
        title: origin[0] + '의 ' + origin[2],
        story: story,
        base: fitStats(BASE_OVR[grade], bias)
      });
    });
    return list;
  }

  const DEX = HAND.map(function (p, i) {
    return {
      no: i + 1, grade: p.grade, name: p.name, pos: p.pos,
      role: p.role || (p.pos === 'P' ? 'SP' : p.pos),
      mbti: p.mbti, title: p.title, story: p.story, base: p.base.slice()
    };
  }).concat(buildGenerated(29, 'R'), buildGenerated(61, 'N'));

  DEX.forEach(function (e) {
    const sum = e.base.reduce(function (a, b) { return a + b; }, 0);
    if (e.base.length !== 6 || sum !== BASE_OVR[e.grade] * 6 || e.base.some(function (n) { return n < 1 || n > 79; })) {
      throw new Error('도감 기본 능력치 오류 #' + e.no);
    }
  });
  (function () {
    const bats = DEX.filter(function (e) { return e.pos !== 'P'; });
    const pits = DEX.filter(function (e) { return e.pos === 'P'; });
    if (DEX.length !== 124 || bats.length !== 62 || pits.length !== 62) {
      throw new Error('도감 타자/투수 수 오류 ' + bats.length + '/' + pits.length);
    }
    const legends = DEX.filter(function (e) { return e.grade === 'L'; });
    const uniques = DEX.filter(function (e) { return e.grade === 'U'; });
    const legRoles = legends.map(function (e) { return e.role; }).sort().join(',');
    if (legRoles !== '1B,CL,LF,SP') throw new Error('레전드 포지션 오류 ' + legRoles);
    const uCount = { SP: 0, RP: 0, IF: 0, OF: 0, DH: 0 };
    uniques.forEach(function (e) {
      if (e.role === 'SP') uCount.SP++;
      else if (e.role === 'RP' || e.role === 'CL') uCount.RP++;
      else if (e.pos === 'DH') uCount.DH++;
      else if (e.pos === 'LF' || e.pos === 'CF' || e.pos === 'RF') uCount.OF++;
      else uCount.IF++;
    });
    if (uCount.SP !== 2 || uCount.RP !== 1 || uCount.IF !== 2 || uCount.OF !== 2 || uCount.DH !== 1) {
      throw new Error('유니크 포지션 오류 ' + JSON.stringify(uCount));
    }
  })();

  let seq = 0;
  function newId() {
    seq += 1;
    return 'c' + Date.now().toString(36) + seq.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }
  function pad(no) { return '#' + String(no).padStart(3, '0'); }
  function entry(no) { return DEX[no - 1] || null; }
  function isPitcher(e) { return e && e.pos === 'P'; }
  function isStarter(e) { return !!(e && e.role === 'SP'); }
  function isBullpen(e) { return !!(e && (e.role === 'RP' || e.role === 'CL')); }
  function labels(e) { return isPitcher(e) ? PIT_LABELS : BAT_LABELS; }
  const GRADE_INK = {
    N: { sky0: '#6d7c8c', sky1: '#243140', glow: '#d5dde6', uni: '#e8eef5', skin: '#f0c9a0', dirt: '#c4844a' },
    R: { sky0: '#1fa86a', sky1: '#0c3d28', glow: '#b8ffd4', uni: '#e9fff4', skin: '#f0c9a0', dirt: '#c4844a' },
    S: { sky0: '#3d7eef', sky1: '#10244e', glow: '#c5d8ff', uni: '#e7f0ff', skin: '#f0c9a0', dirt: '#c4844a' },
    U: { sky0: '#8d5ae0', sky1: '#2a1254', glow: '#e4d0ff', uni: '#f6efff', skin: '#f0c9a0', dirt: '#c4844a' },
    L: { sky0: '#f0c14a', sky1: '#5a3d08', glow: '#fff1b8', uni: '#fff8df', skin: '#f0c9a0', dirt: '#e0b07a' }
  };
  let portraitSeq = 0;
  function portraitSVG(entry) {
    const ink = GRADE_INK[entry.grade] || GRADE_INK.N;
    const kind = entry.pos === 'P' ? 'pit' : entry.pos === 'C' ? 'cat' : 'bat';
    portraitSeq += 1;
    const gid = 'pg' + portraitSeq + 'n' + entry.no;
    let scene = '';
    if (kind === 'pit') {
      scene = '<ellipse cx="120" cy="104" rx="54" ry="12" fill="' + ink.dirt + '"/>' +
        '<ellipse cx="120" cy="100" rx="28" ry="7" fill="#efd0a4"/>' +
        '<path d="M92 78 L104 96 L116 78 L128 98" fill="none" stroke="' + ink.uni + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M108 70 C104 86 132 78 138 58" fill="none" stroke="' + ink.uni + '" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M138 58 L156 46" stroke="' + ink.glow + '" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="108" cy="52" r="11" fill="' + ink.skin + '"/>' +
        '<path d="M98 50 Q108 40 120 48" fill="' + ink.sky1 + '"/>' +
        '<circle cx="164" cy="40" r="5" fill="#fff" stroke="#e74c3c" stroke-width="1.4"/>' +
        '<path d="M168 36 L186 28 M170 44 L190 46 M162 32 L176 22" stroke="' + ink.glow + '" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M96 74 L78 88" stroke="' + ink.uni + '" stroke-width="6" stroke-linecap="round"/>' +
        '<ellipse cx="74" cy="90" rx="8" ry="6" fill="#f4f7fb" transform="rotate(-20 74 90)"/>';
    } else if (kind === 'cat') {
      scene = '<ellipse cx="120" cy="108" rx="46" ry="8" fill="' + ink.dirt + '"/>' +
        '<path d="M96 96 Q90 78 104 74 Q112 96 120 98 Q128 78 142 76 Q150 96 132 100 Z" fill="' + ink.uni + '"/>' +
        '<circle cx="118" cy="62" r="12" fill="' + ink.skin + '"/>' +
        '<path d="M104 62 Q118 48 134 62 Q118 70 104 62" fill="' + ink.sky1 + '" stroke="' + ink.glow + '" stroke-width="1.5"/>' +
        '<path d="M108 66 H128" stroke="' + ink.glow + '" stroke-width="2"/>' +
        '<rect x="104" y="74" width="30" height="16" rx="4" fill="' + ink.sky1 + '" opacity="0.85"/>' +
        '<path d="M142 82 L168 70" stroke="' + ink.uni + '" stroke-width="6" stroke-linecap="round"/>' +
        '<ellipse cx="174" cy="66" rx="12" ry="9" fill="#f7f9fb" stroke="' + ink.glow + '" stroke-width="2"/>' +
        '<circle cx="186" cy="58" r="4.5" fill="#fff" stroke="#e74c3c" stroke-width="1.3"/>' +
        '<path d="M88 90 Q72 96 78 108" fill="none" stroke="' + ink.uni + '" stroke-width="6" stroke-linecap="round"/>';
    } else {
      scene = '<path d="M28 108 H210" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>' +
        '<path d="M78 100 L92 78 L108 100 L124 76" fill="none" stroke="' + ink.uni + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M100 74 C108 58 128 66 132 84" fill="none" stroke="' + ink.uni + '" stroke-width="8" stroke-linecap="round"/>' +
        '<circle cx="124" cy="52" r="11" fill="' + ink.skin + '"/>' +
        '<path d="M112 50 Q124 38 136 50 L130 46 Q124 42 116 48 Z" fill="' + ink.sky1 + '"/>' +
        '<path d="M96 70 L58 46" stroke="#f4f1ea" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M70 62 Q92 40 118 58" fill="none" stroke="' + ink.glow + '" stroke-width="2" stroke-dasharray="3 3"/>' +
        '<circle cx="48" cy="40" r="5" fill="#fff" stroke="#e74c3c" stroke-width="1.4"/>' +
        '<path d="M132 66 L158 88" stroke="' + ink.uni + '" stroke-width="6" stroke-linecap="round"/>' +
        '<ellipse cx="164" cy="92" rx="9" ry="6" fill="#f4f7fb"/>';
    }
    return '<svg class="portrait" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + ink.sky0 + '"/><stop offset="1" stop-color="' + ink.sky1 + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="240" height="120" rx="10" fill="url(#' + gid + ')"/>' +
      '<ellipse cx="120" cy="18" rx="70" ry="22" fill="' + ink.glow + '" opacity="0.28"/>' +
      '<path d="M0 92 Q120 70 240 92 V120 H0 Z" fill="#1e8a42"/>' +
      '<path d="M0 104 Q120 86 240 104" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>' +
      scene +
      '<rect x="0" y="0" width="240" height="120" fill="none" stroke="' + ink.glow + '" stroke-width="3" opacity="0.65"/>' +
      '</svg>';
  }
  function radarSVG(labels, stats) {
    const cx = 90, cy = 78, R = 48, n = 6;
    let rings = '', axes = '', poly = [], texts = '';
    for (let k = 1; k <= 4; k++) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 3;
        pts.push((cx + Math.cos(a) * R * k / 4).toFixed(1) + ',' + (cy + Math.sin(a) * R * k / 4).toFixed(1));
      }
      rings += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>';
    }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const v = Math.max(0, Math.min(99, Number(stats[i]) || 0)) / 99;
      poly.push((cx + Math.cos(a) * R * v).toFixed(1) + ',' + (cy + Math.sin(a) * R * v).toFixed(1));
      const x2 = cx + Math.cos(a) * R, y2 = cy + Math.sin(a) * R;
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>';
      const lx = cx + Math.cos(a) * (R + 16);
      const ly = cy + Math.sin(a) * (R + 14) + 3;
      texts += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" fill="#d5dde6" font-size="9" font-family="Malgun Gothic, sans-serif" font-weight="700">' + labels[i] + '</text>';
    }
    return '<svg class="radar" viewBox="0 0 180 156" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      rings + axes +
      '<polygon points="' + poly.join(' ') + '" fill="rgba(255,209,90,0.38)" stroke="#ffd56a" stroke-width="2"/>' +
      texts + '</svg>';
  }

  function rollIv() {
    const iv = [];
    for (let i = 0; i < 6; i++) iv.push(Math.floor(Math.random() * 10) - 4);
    return iv;
  }
  function rollGrade() {
    let n = Math.floor(Math.random() * 10000);
    for (let i = 0; i < RATES.length; i++) {
      if (n < RATES[i].weight) return RATES[i].grade;
      n -= RATES[i].weight;
    }
    return 'N';
  }
  function create(no, iv, plus) {
    return { id: newId(), dex: no, iv: iv || rollIv(), plus: plus || 0 };
  }
  function pullFromGrade(grade, exceptNos) {
    let pool = DEX.filter(function (e) {
      return e.grade === grade && (!exceptNos || exceptNos.indexOf(e.no) < 0);
    });
    if (!pool.length) pool = DEX.filter(function (e) { return e.grade === grade; });
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return create(pick.no, rollIv(), 0);
  }
  function pull() { return pullFromGrade(rollGrade(), null); }
  function starter() {
    const need = ['2B', 'SS', 'CF', '1B', 'LF', '3B', 'RF', 'C', 'DH'];
    const zeros = [0, 0, 0, 0, 0, 0];
    const cards = need.map(function (pos) {
      const found = DEX.find(function (e) { return e.grade === 'N' && e.pos === pos; });
      return create(found.no, zeros.slice(), 0);
    });
    DEX.filter(function (e) { return e.grade === 'N' && e.role === 'SP'; }).slice(0, 5).forEach(function (e) {
      cards.push(create(e.no, zeros.slice(), 0));
    });
    DEX.filter(function (e) { return e.grade === 'N' && e.role === 'RP'; }).slice(0, 4).forEach(function (e) {
      cards.push(create(e.no, zeros.slice(), 0));
    });
    return cards;
  }
  function statsOf(card) {
    const e = entry(card.dex);
    const bonus = GAIN[e.grade] * card.plus;
    return e.base.map(function (b, i) {
      return Math.max(1, Math.min(99, b + card.iv[i] + bonus));
    });
  }
  function ovr(stats) {
    return Math.round(stats.reduce(function (a, b) { return a + b; }, 0) / stats.length);
  }
  function ovrOf(card) { return ovr(statsOf(card)); }
  function ivAverage(iv) {
    return iv.reduce(function (a, b) { return a + b; }, 0) / iv.length;
  }
  function launchDegrees(pos, angRating) {
    const t = (angRating - 50) / 49;
    let deg = 12 + t * 8;
    if (pos === 'DH' || pos === '1B' || pos === 'LF') deg += 1.2;
    if (pos === '2B' || pos === 'SS' || pos === 'C') deg -= 0.8;
    return Math.max(6, Math.min(24, deg));
  }
  function toBatter(card) {
    const e = entry(card.dex);
    const s = statsOf(card);
    return {
      name: e.name, pos: e.pos, type: e.grade,
      rct: s[0], spd: s[1], ang: s[2], con: s[3], pow: s[4], fld: s[5],
      launch: launchDegrees(e.pos, s[2]), ovr: ovr(s)
    };
  }
  function toPitcher(card) {
    const e = entry(card.dex);
    const s = statsOf(card);
    return {
      name: e.name, spd: s[0], ctrl: s[1], stuff: s[2], brk: s[3], stm: s[4], mnt: s[5],
      ovr: ovr(s), stamina: 100, role: e.role || 'SP', pos: 'P'
    };
  }
  function enhanceCost(grade, plus) {
    const table = { N: [300, 80], R: [600, 150], S: [1500, 400], U: [4000, 1000], L: [8000, 2500] };
    return table[grade][0] + plus * table[grade][1];
  }
  function tradeUpgrades(grade) {
    if (!TRADE_UP[grade]) return false;
    return Math.floor(Math.random() * 10000) < TRADE_UP[grade];
  }
  function fullOvr(grade) { return BASE_OVR[grade] + MAX_PLUS[grade] * GAIN[grade]; }

  root.Cards = {
    DEX: DEX,
    BASE_OVR: BASE_OVR,
    MAX_PLUS: MAX_PLUS,
    GAIN: GAIN,
    RATES: RATES,
    SCOUT_COST: 1500,
    LEAGUE_GOLD: 1500,
    gradeName: function (g) { return GRADE_NAME[g]; },
    nextGrade: function (g) { return NEXT_GRADE[g]; },
    posKo: POS_KO,
    pad: pad,
    entry: entry,
    isPitcher: isPitcher,
    isStarter: isStarter,
    isBullpen: isBullpen,
    labels: labels,
    portraitSVG: portraitSVG,
    radarSVG: radarSVG,
    rollIv: rollIv,
    create: create,
    pull: pull,
    pullFromGrade: pullFromGrade,
    starter: starter,
    statsOf: statsOf,
    ovr: ovr,
    ovrOf: ovrOf,
    ivAverage: ivAverage,
    launchDegrees: launchDegrees,
    toBatter: toBatter,
    toPitcher: toPitcher,
    enhanceCost: enhanceCost,
    tradeUpgrades: tradeUpgrades,
    fullOvr: fullOvr,
    newId: newId
  };
})(typeof window !== 'undefined' ? window : globalThis);
