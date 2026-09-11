// Example ESP32 output for the dashboard.
// Replace these demo values with your real sensor calculations.

void setup() {
  Serial.begin(115200);
}

void loop() {
  float vibration = 2.8;
  float current = 12.4;
  float temperature = 46.2;
  int rpm = 1450;
  float alignment = 1.8;
  float tension = 62.5;

  Serial.print("{\"vibration\":"); Serial.print(vibration,1);
  Serial.print(",\"current\":"); Serial.print(current,1);
  Serial.print(",\"temperature\":"); Serial.print(temperature,1);
  Serial.print(",\"rpm\":"); Serial.print(rpm);
  Serial.print(",\"alignment\":"); Serial.print(alignment,1);
  Serial.print(",\"tension\":"); Serial.print(tension,1);
  Serial.println("}");

  delay(500);
}
