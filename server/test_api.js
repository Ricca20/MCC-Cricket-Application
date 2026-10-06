async function test() {
  try {
    const res1 = await fetch('http://localhost:4000/api/players/6ab812716ff93e7b761b42d4');
    const text1 = await res1.text();
    console.log("res1:", res1.status, text1);
  } catch (err) {
    console.error("res1 err:", err);
  }

  try {
    const res2 = await fetch('http://localhost:4000/api/players/6ab812716ff93e7b761b42d4/trends');
    const text2 = await res2.text();
    console.log("res2:", res2.status, text2);
  } catch (err) {
    console.error("res2 err:", err);
  }
}

test();
