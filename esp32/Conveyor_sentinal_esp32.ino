#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <math.h>

// =====================================================
//                    PIN DEFINITIONS
// =====================================================

// Sensors
#define ACS_PIN       14
#define IR_PIN        32
#define VIB_PIN       34
#define DHT_PIN       4
#define DHT_TYPE      DHT11

// Relay
#define RELAY_PIN     33

// LCD
#define LCD_SDA       21
#define LCD_SCL       22

// Buzzer
#define BUZZER_PIN    18

// LED
#define LED_PIN       23

// =====================================================
//                    L298N MOTOR
// =====================================================

// Motor 1 / Channel A
#define MOTOR_IN1     25
#define MOTOR_IN2     26
#define MOTOR_ENA     27

// Motor 2 / Channel B
#define MOTOR_IN3     5
#define MOTOR_IN4     12
#define MOTOR_ENB     15

// =====================================================
//                    LCD
// =====================================================

LiquidCrystal_I2C lcd(0x27, 16, 2);

// =====================================================
//                    DHT
// =====================================================

DHT dht(DHT_PIN, DHT_TYPE);

// =====================================================
//                    ACS712
// =====================================================

// 20A ACS712
#define ACS_SENSITIVITY  0.100

#define ADC_VREF         3.3
#define ADC_RESOLUTION   4095.0

// Your previous calibration
#define ACS_ZERO_OFFSET  2.347

// =====================================================
//                    RPM
// =====================================================

#define PULSES_PER_REV   1

volatile unsigned long rpmPulses = 0;

// =====================================================
//                    PWM
// =====================================================

#define PWM_FREQ         5000
#define PWM_RES          8

int motorSpeedA = 200;
int motorSpeedB = 200;

// =====================================================
//                    VARIABLES
// =====================================================

float temperature = 0.0;
float humidity = 0.0;
float current = 0.0;
float rpm = 0.0;

bool vibration = false;
bool relayState = false;

bool motorAState = false;
bool motorBState = false;

unsigned long lastSensorRead = 0;
unsigned long lastLCDUpdate = 0;

int lcdPage = 0;

// =====================================================
//                    RPM INTERRUPT
// =====================================================

void IRAM_ATTR rpmISR()
{
  rpmPulses++;
}

// =====================================================
//                    ACS712
// =====================================================

float readCurrent()
{
  const int samples = 100;

  long total = 0;

  for (int i = 0; i < samples; i++)
  {
    total += analogRead(ACS_PIN);
    delayMicroseconds(100);
  }

  float averageRaw =
      total / (float)samples;

  float voltage =
      (averageRaw / ADC_RESOLUTION) * ADC_VREF;

  float amps =
      (voltage - ACS_ZERO_OFFSET)
      / ACS_SENSITIVITY;

  if (fabs(amps) < 0.05)
  {
    amps = 0.0;
  }

  return amps;
}

// =====================================================
//                    VIBRATION
// =====================================================

bool readVibration()
{
  int highCount = 0;

  for (int i = 0; i < 10; i++)
  {
    if (digitalRead(VIB_PIN) == HIGH)
    {
      highCount++;
    }

    delay(5);
  }

  return highCount >= 7;
}

// =====================================================
//                    MOTOR A
// =====================================================

void motorAForward()
{
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);

  ledcWrite(MOTOR_ENA, motorSpeedA);

  motorAState = true;
}

void motorABackward()
{
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, HIGH);

  ledcWrite(MOTOR_ENA, motorSpeedA);

  motorAState = true;
}

void motorAStop()
{
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);

  ledcWrite(MOTOR_ENA, 0);

  motorAState = false;
}

// =====================================================
//                    MOTOR B
// =====================================================

void motorBForward()
{
  digitalWrite(MOTOR_IN3, HIGH);
  digitalWrite(MOTOR_IN4, LOW);

  ledcWrite(MOTOR_ENB, motorSpeedB);

  motorBState = true;
}

void motorBBackward()
{
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, HIGH);

  ledcWrite(MOTOR_ENB, motorSpeedB);

  motorBState = true;
}

void motorBStop()
{
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);

  ledcWrite(MOTOR_ENB, 0);

  motorBState = false;
}

// =====================================================
//                    BOTH MOTORS
// =====================================================

void motorsForward()
{
  motorAForward();
  motorBForward();
}

void motorsBackward()
{
  motorABackward();
  motorBBackward();
}

void motorsStop()
{
  motorAStop();
  motorBStop();
}

// =====================================================
//                    RELAY
// =====================================================

void relayON()
{
  digitalWrite(RELAY_PIN, HIGH);
  relayState = true;
}

void relayOFF()
{
  digitalWrite(RELAY_PIN, LOW);
  relayState = false;
}

// =====================================================
//                    LCD PAGE 1
// =====================================================

void showPage1()
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(temperature, 1);
  lcd.print("C ");

  lcd.print("H:");
  lcd.print(humidity, 0);
  lcd.print("%");

  lcd.setCursor(0, 1);
  lcd.print("I:");
  lcd.print(current, 2);
  lcd.print("A");

  lcd.print(" R:");
  lcd.print(rpm, 0);
}

// =====================================================
//                    LCD PAGE 2
// =====================================================

void showPage2()
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("VIB:");

  if (vibration)
    lcd.print("DETECTED");
  else
    lcd.print("NORMAL");

  lcd.setCursor(0, 1);

  lcd.print("Relay:");

  if (relayState)
    lcd.print("ON ");
  else
    lcd.print("OFF");

  lcd.print(" LED:");

  if (vibration)
    lcd.print("ON");
  else
    lcd.print("OFF");
}

// =====================================================
//                    LCD PAGE 3
// =====================================================

void showPage3()
{
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("M1:");

  if (motorAState)
    lcd.print("ON ");
  else
    lcd.print("OFF");

  lcd.print(" M2:");

  if (motorBState)
    lcd.print("ON");
  else
    lcd.print("OFF");

  lcd.setCursor(0, 1);
  lcd.print("RPM:");
  lcd.print(rpm, 0);

  lcd.print(" S:");
  lcd.print(motorSpeedA);
}

// =====================================================
//                    SERIAL STATUS
// =====================================================

void printStatus()
{
  Serial.println();
  Serial.println("====================================");
  Serial.println("          SMART MACH STATUS");
  Serial.println("====================================");

  Serial.print("Temperature : ");
  Serial.print(temperature, 1);
  Serial.println(" C");

  Serial.print("Humidity    : ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  Serial.print("Current     : ");
  Serial.print(current, 3);
  Serial.println(" A");

  Serial.print("Vibration   : ");

  if (vibration)
    Serial.println("DETECTED");
  else
    Serial.println("NORMAL");

  Serial.print("RPM         : ");
  Serial.print(rpm, 1);
  Serial.println();

  Serial.print("Motor A     : ");

  if (motorAState)
    Serial.println("RUNNING");
  else
    Serial.println("STOPPED");

  Serial.print("Motor B     : ");

  if (motorBState)
    Serial.println("RUNNING");
  else
    Serial.println("STOPPED");

  Serial.print("Relay       : ");

  if (relayState)
    Serial.println("ON");
  else
    Serial.println("OFF");

  Serial.println("====================================");
}

// =====================================================
//                    COMMANDS
// =====================================================

void handleSerial()
{
  if (!Serial.available())
    return;

  char command = Serial.read();

  switch (command)
  {
    case 'F':
    case 'f':
      motorsForward();
      Serial.println(">> BOTH MOTORS FORWARD");
      break;

    case 'B':
    case 'b':
      motorsBackward();
      Serial.println(">> BOTH MOTORS BACKWARD");
      break;

    case 'S':
    case 's':
      motorsStop();
      Serial.println(">> BOTH MOTORS STOP");
      break;

    case 'A':
    case 'a':
      motorAForward();
      Serial.println(">> MOTOR A FORWARD");
      break;

    case 'C':
    case 'c':
      motorBForward();
      Serial.println(">> MOTOR B FORWARD");
      break;

    case 'X':
    case 'x':
      motorAStop();
      Serial.println(">> MOTOR A STOP");
      break;

    case 'Y':
    case 'y':
      motorBStop();
      Serial.println(">> MOTOR B STOP");
      break;

    case 'R':
    case 'r':
      relayON();
      Serial.println(">> RELAY ON");
      break;

    case 'O':
    case 'o':
      relayOFF();
      Serial.println(">> RELAY OFF");
      break;

    case 'T':
    case 't':
      printStatus();
      break;
  }
}

// =====================================================
//                       SETUP
// =====================================================

void setup()
{
  Serial.begin(115200);

  delay(1000);

  // ---------------- Sensors ----------------

  pinMode(ACS_PIN, INPUT);
  pinMode(VIB_PIN, INPUT);

  dht.begin();

  // ---------------- Relay ----------------

  pinMode(RELAY_PIN, OUTPUT);
  relayOFF();

  // ---------------- Buzzer ----------------

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // ---------------- LED ----------------

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // ---------------- Motor pins ----------------

  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);

  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);

  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);

  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);

  // ---------------- PWM ----------------

  ledcAttach(
    MOTOR_ENA,
    PWM_FREQ,
    PWM_RES
  );

  ledcAttach(
    MOTOR_ENB,
    PWM_FREQ,
    PWM_RES
  );

  ledcWrite(MOTOR_ENA, 0);
  ledcWrite(MOTOR_ENB, 0);

  // ---------------- IR RPM ----------------

  pinMode(IR_PIN, INPUT_PULLUP);

  attachInterrupt(
    digitalPinToInterrupt(IR_PIN),
    rpmISR,
    RISING
  );

  // ---------------- LCD ----------------

  Wire.begin(
    LCD_SDA,
    LCD_SCL
  );

  lcd.init();
  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SMART MACH");

  lcd.setCursor(0, 1);
  lcd.print("Starting...");

  delay(2000);

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SYSTEM READY");

  lcd.setCursor(0, 1);
  lcd.print("ESP32 OK");

  // ---------------- Serial ----------------

  Serial.println();
  Serial.println("====================================");
  Serial.println("          SMART MACH ESP32");
  Serial.println("====================================");
  Serial.println("SYSTEM READY");
  Serial.println();

  Serial.println("MOTOR COMMANDS");
  Serial.println("----------------");
  Serial.println("F = BOTH FORWARD");
  Serial.println("B = BOTH BACKWARD");
  Serial.println("S = BOTH STOP");
  Serial.println("A = MOTOR A FORWARD");
  Serial.println("C = MOTOR B FORWARD");
  Serial.println("X = MOTOR A STOP");
  Serial.println("Y = MOTOR B STOP");

  Serial.println();
  Serial.println("RELAY");
  Serial.println("----------------");
  Serial.println("R = RELAY ON");
  Serial.println("O = RELAY OFF");

  Serial.println();
  Serial.println("T = STATUS");

  Serial.println("====================================");

  lastSensorRead = millis();
  lastLCDUpdate = millis();
}

// =====================================================
//                       LOOP
// =====================================================

void loop()
{
  // Serial commands
  handleSerial();

  // ===================================================
  //                  SENSOR UPDATE
  // ===================================================

  if (millis() - lastSensorRead >= 1000)
  {
    lastSensorRead = millis();

    // DHT11
    float t = dht.readTemperature();
    float h = dht.readHumidity();

    if (!isnan(t))
      temperature = t;

    if (!isnan(h))
      humidity = h;

    // ACS712
    current = readCurrent();

    // Vibration
    vibration = readVibration();

    // =================================================
    //                     RPM
    // =================================================

    noInterrupts();

    unsigned long pulses = rpmPulses;

    rpmPulses = 0;

    interrupts();

    // One pulse = one revolution
    rpm = (pulses * 60.0);

    // =================================================
    //                 VIBRATION ALERT
    // =================================================

    if (vibration)
    {
      digitalWrite(LED_PIN, HIGH);

      tone(
        BUZZER_PIN,
        2000
      );
    }
    else
    {
      digitalWrite(LED_PIN, LOW);

      noTone(BUZZER_PIN);
    }

    printStatus();
  }

  // ===================================================
  //                    LCD UPDATE
  // ===================================================

  if (millis() - lastLCDUpdate >= 2500)
  {
    lastLCDUpdate = millis();

    lcdPage++;

    if (lcdPage > 2)
      lcdPage = 0;

    if (lcdPage == 0)
      showPage1();

    else if (lcdPage == 1)
      showPage2();

    else
      showPage3();
  }
}
