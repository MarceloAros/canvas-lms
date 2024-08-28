/*
 * Copyright (C) 2024 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React, {useEffect, useState} from 'react'
import {useScope as useI18nScope} from '@canvas/i18n'
import {Heading} from '@instructure/ui-heading'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {Button, CloseButton} from '@instructure/ui-buttons'
import {Tray} from '@instructure/ui-tray'
import {Alert} from '@instructure/ui-alerts'
import {List} from '@instructure/ui-list'
import {Checkbox} from '@instructure/ui-checkbox'
import NumberInputControlled from './NumberInputControlled'
import {showFlashAlert} from '@canvas/alerts/react/FlashAlert'
import {executeApiRequest} from '@canvas/do-fetch-api-effect/apiRequest'
import type {GlobalEnv} from '@canvas/global/env/GlobalEnv.d'
import {Flex} from '@instructure/ui-flex'
import CustomForbiddenWordsSection from './CustomForbiddenWordsSection'
import type {PasswordPolicy, PasswordSettings, PasswordSettingsResponse} from './types'

const I18n = useI18nScope('password_complexity_configuration')

declare const ENV: GlobalEnv

const MINIMUM_CHARACTER_LENGTH = 8
const MAXIMUM_CHARACTER_LENGTH = 255
const DEFAULT_MAX_LOGIN_ATTEMPTS = 10
const MINIMUM_LOGIN_ATTEMPTS = 3
const MAXIMUM_LOGIN_ATTEMPTS = 20

interface Account {
  settings: PasswordSettings
}

interface QueryParams {
  account: Account
}

const PasswordComplexityConfiguration = () => {
  const [showTray, setShowTray] = useState(false)
  const [enableApplyButton, setEnableApplyButton] = useState(true)
  const [minimumCharacterLengthEnabled, setMinimumCharacterLengthEnabled] = useState(true)
  const [minimumCharacterLength, setMinimumCharacterLength] = useState(MINIMUM_CHARACTER_LENGTH)
  const [requireNumbersEnabled, setRequireNumbersEnabled] = useState(true)
  const [requireSymbolsEnabled, setRequireSymbolsEnabled] = useState(false)
  const [customMaxLoginAttemptsEnabled, setCustomMaxLoginAttemptsEnabled] = useState(false)
  const [allowLoginSuspensionEnabled, setAllowLoginSuspensionEnabled] = useState(false)
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(DEFAULT_MAX_LOGIN_ATTEMPTS)

  const handleOpenTray = () => {
    setShowTray(true)
  }

  useEffect(() => {
    if (showTray) {
      const fetchCurrentSettings = async () => {
        try {
          const {status, data} = await executeApiRequest<PasswordSettingsResponse>({
            path: `/api/v1/accounts/${ENV.DOMAIN_ROOT_ACCOUNT_ID}/settings`,
            method: 'GET',
          })

          if (status === 200) {
            const passwordPolicy = data.password_policy

            if (passwordPolicy.require_number_characters === 'true') {
              setRequireNumbersEnabled(true)
            } else {
              setRequireNumbersEnabled(false)
            }

            if (passwordPolicy.require_symbol_characters === 'true') {
              setRequireSymbolsEnabled(true)
            } else {
              setRequireSymbolsEnabled(false)
            }

            if (passwordPolicy.minimum_character_length) {
              setMinimumCharacterLength(passwordPolicy.minimum_character_length)
              setMinimumCharacterLengthEnabled(true)
            } else {
              setMinimumCharacterLengthEnabled(false)
            }

            if (passwordPolicy.maximum_login_attempts) {
              setMaxLoginAttempts(passwordPolicy.maximum_login_attempts)
              setCustomMaxLoginAttemptsEnabled(true)
            } else {
              setCustomMaxLoginAttemptsEnabled(false)
            }

            if (passwordPolicy.allow_login_suspension === 'true') {
              setAllowLoginSuspensionEnabled(true)
            } else {
              setAllowLoginSuspensionEnabled(false)
            }
          }
        } catch (err: any) {
          // err type has to be any because the error object is not defined
          showFlashAlert({
            message: I18n.t('An error occurred fetching password policy settings.'),
            err,
            type: 'error',
          })
        }
      }

      fetchCurrentSettings()
    }
  }, [showTray])

  const handleCustomMaxLoginAttemptToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked
    setCustomMaxLoginAttemptsEnabled(checked)
    if (allowLoginSuspensionEnabled && !checked) {
      setAllowLoginSuspensionEnabled(false)
    }
  }

  const handleAllowLoginSuspensionToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked
    setAllowLoginSuspensionEnabled(checked)
  }

  const handleMinimumCharacterChange = (value: number) => {
    setMinimumCharacterLength(value)
  }

  const handleMaxLoginAttemptsChange = (value: number) => {
    setMaxLoginAttempts(value)
  }

  const cancelChanges = async () => {
    setShowTray(false)
  }

  const saveChanges = async () => {
    setEnableApplyButton(false)

    const currentSettingsUrl = `/api/v1/accounts/${ENV.DOMAIN_ROOT_ACCOUNT_ID}/settings`
    const {status, data: settingsResult} = await executeApiRequest<PasswordSettingsResponse>({
      path: currentSettingsUrl,
      method: 'GET',
    })

    if (status !== 200) {
      throw new Error('Failed to fetch current settings.')
    }

    const passwordPolicy: PasswordPolicy = {
      require_number_characters: requireNumbersEnabled,
      require_symbol_characters: requireSymbolsEnabled,
      allow_login_suspension: allowLoginSuspensionEnabled,
    }

    if (settingsResult.password_policy.common_passwords_attachment_id) {
      passwordPolicy.common_passwords_attachment_id =
        settingsResult.password_policy.common_passwords_attachment_id
    }

    if (settingsResult.password_policy.common_passwords_folder_id) {
      passwordPolicy.common_passwords_folder_id =
        settingsResult.password_policy.common_passwords_folder_id
    }

    if (customMaxLoginAttemptsEnabled) {
      passwordPolicy.maximum_login_attempts = maxLoginAttempts
    }

    if (minimumCharacterLengthEnabled) {
      passwordPolicy.minimum_character_length = minimumCharacterLength
    }

    const requestBody: QueryParams = {
      account: {
        settings: {
          password_policy: passwordPolicy,
        },
      },
    }

    try {
      const {status: accountStatus} = await executeApiRequest<QueryParams>({
        path: `/api/v1/accounts/${ENV.DOMAIN_ROOT_ACCOUNT_ID}/`,
        body: requestBody,
        method: 'PUT',
      })
      if (accountStatus === 200) {
        showFlashAlert({
          message: I18n.t('Password settings saved successfully.'),
          type: 'success',
        })
        setShowTray(false)
      }
    } catch (err: any) {
      // err type has to be any because the error object is not defined
      showFlashAlert({
        message: I18n.t('An error occurred applying password policy settings.'),
        err,
        type: 'error',
      })
    } finally {
      setEnableApplyButton(true)
    }
  }

  return (
    <>
      <Heading margin="small auto xx-small auto" level="h4">
        {I18n.t('Password Options')}
      </Heading>
      <Button onClick={handleOpenTray} color="secondary">
        {I18n.t('View Options')}
      </Button>
      <Tray
        label="Password Options Tray"
        open={showTray}
        onDismiss={() => setShowTray(false)}
        placement="end"
        size="medium"
      >
        <Flex as="div" direction="column" height="100vh">
          <Flex.Item shouldGrow={true} shouldShrink={true} padding="small" as="main">
            <Flex as="div" direction="row" justifyItems="space-between">
              <Flex.Item>
                <View as="div" margin="small 0 small medium">
                  <Heading level="h3">{I18n.t('Password Options')}</Heading>
                </View>
              </Flex.Item>
              <Flex.Item>
                <CloseButton
                  margin="xxx-small 0 0 0"
                  offset="small"
                  screenReaderLabel="Close"
                  onClick={() => setShowTray(false)}
                />
              </Flex.Item>
            </Flex>
            <View as="div" margin="0 0 0 medium">
              <View as="div" margin="xxx-small auto small auto">
                <Text size="small" lineHeight="fit">
                  {I18n.t(
                    'Some institutions have very strict policies regarding passwords. This feature enables customization of password requirements and options for this auth provider. Modifications to password options will customize the password configuration text as seen below. If a custom minimum character length or maximum login attempts is not set, their default values will be used.'
                  )}
                </Text>
              </View>
              <Heading level="h4">{I18n.t('Current Password Configuration')}</Heading>
            </View>
            <Alert variant="info" margin="small medium medium medium">
              {I18n.t('Your password must meet the following requirements')}
              <List margin="xxx-small">
                <List.Item>
                  {I18n.t('Must be at least %{minimumCharacterLength} Characters in length.', {
                    minimumCharacterLength,
                  })}
                </List.Item>
                {requireNumbersEnabled && (
                  <List.Item>{I18n.t('Must contain a number character (ie: 0...9).')}</List.Item>
                )}
                {requireSymbolsEnabled && (
                  <List.Item>
                    {I18n.t('Must contain a symbol character (ie: ! @ # $ %).')}
                  </List.Item>
                )}
                <List.Item>
                  {I18n.t(
                    'Must not use words or sequences of characters common in passwords (ie: password, 12345, etc...)'
                  )}
                </List.Item>
              </List>
            </Alert>
            <View as="div" margin="medium medium small medium">
              <Checkbox
                label={I18n.t('Minimum character length (minimum: 8 | maximum: 255)')}
                checked={minimumCharacterLengthEnabled}
                onChange={() => setMinimumCharacterLengthEnabled(!minimumCharacterLengthEnabled)}
                defaultChecked={true}
                data-testid="minimumCharacterLengthCheckbox"
              />
            </View>
            <View as="div" maxWidth="9rem" margin="0 medium medium medium">
              <View as="div" margin="0 medium medium medium">
                <NumberInputControlled
                  minimum={MINIMUM_CHARACTER_LENGTH}
                  maximum={MAXIMUM_CHARACTER_LENGTH}
                  currentValue={minimumCharacterLength}
                  updateCurrentValue={handleMinimumCharacterChange}
                  disabled={!minimumCharacterLengthEnabled}
                  data-testid="minimumCharacterLengthInput"
                />
              </View>
            </View>
            <View as="div" margin="medium">
              <Checkbox
                label={I18n.t('Require number characters (0...9)')}
                checked={requireNumbersEnabled}
                onChange={() => setRequireNumbersEnabled(!requireNumbersEnabled)}
                data-testid="requireNumbersCheckbox"
              />
            </View>
            <View as="div" margin="medium">
              <Checkbox
                label={I18n.t('Require symbol characters (ie: ! @ # $ %)')}
                checked={requireSymbolsEnabled}
                onChange={() => setRequireSymbolsEnabled(!requireSymbolsEnabled)}
                data-testid="requireSymbolsCheckbox"
              />
            </View>
            <CustomForbiddenWordsSection />
            <View as="div" margin="medium medium small medium">
              <Checkbox
                onChange={handleCustomMaxLoginAttemptToggle}
                checked={customMaxLoginAttemptsEnabled}
                label={I18n.t('Customize maximum login attempts (default 10 attempts)')}
                data-testid="customMaxLoginAttemptsCheckbox"
              />
              <View
                as="div"
                insetInlineStart="1.75em"
                position="relative"
                margin="xx-small small xxx-small 0"
              >
                <Text size="small">
                  {I18n.t(
                    'This option controls the number of attempts a single user can make consecutively to login without success before their user’s login is suspended temporarily (5 min). Cannot be higher than 20 attempts.'
                  )}
                </Text>
              </View>
            </View>
            <View as="div" margin="0 medium medium medium">
              <View as="div" maxWidth="6rem" margin="0 medium medium medium">
                <NumberInputControlled
                  minimum={MINIMUM_LOGIN_ATTEMPTS}
                  maximum={MAXIMUM_LOGIN_ATTEMPTS}
                  currentValue={maxLoginAttempts}
                  updateCurrentValue={handleMaxLoginAttemptsChange}
                  disabled={!customMaxLoginAttemptsEnabled}
                  data-testid="customMaxLoginAttemptsInput"
                />
              </View>
              <View as="div" margin="medium medium small medium">
                <Checkbox
                  onChange={handleAllowLoginSuspensionToggle}
                  checked={allowLoginSuspensionEnabled}
                  label={I18n.t('Make login suspension persistent')}
                  data-testid="allowLoginSuspensionCheckbox"
                  disabled={!customMaxLoginAttemptsEnabled}
                />
                <View
                  as="div"
                  insetInlineStart="1.75em"
                  position="relative"
                  margin="xx-small small xxx-small 0"
                >
                  <Text size="small">
                    {I18n.t(
                      'Users with a suspended login (because of maximum login attempt policy) must be unsuspended by institutional admins.'
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </Flex.Item>
          <Flex.Item as="footer">
            <View as="div" background="secondary" width="100%" textAlign="end">
              <View as="div" display="inline-block">
                <Button
                  margin="small 0"
                  color="secondary"
                  onClick={cancelChanges}
                  data-testid="cancelButton"
                >
                  {I18n.t('Cancel')}
                </Button>
                <Button
                  margin="small"
                  color="primary"
                  onClick={saveChanges}
                  disabled={!enableApplyButton}
                  data-testid="saveButton"
                >
                  {I18n.t('Apply')}
                </Button>
              </View>
            </View>
          </Flex.Item>
        </Flex>
      </Tray>
    </>
  )
}

export default PasswordComplexityConfiguration
